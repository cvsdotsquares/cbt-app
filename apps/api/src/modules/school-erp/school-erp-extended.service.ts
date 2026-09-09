import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  FeeInvoiceStatus,
  AdmissionApplicationStatus,
  StudentLeaveStatus,
  OnlinePaymentStatus,
  CertificateType,
  BoardType,
  AttendanceStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';

const DEFAULT_GRADE_RULES = {
  A_PLUS: { min: 90, max: 100 },
  A: { min: 80, max: 89 },
  B_PLUS: { min: 70, max: 79 },
  B: { min: 60, max: 69 },
  C: { min: 50, max: 59 },
  D: { min: 40, max: 49 },
  F: { min: 0, max: 39 },
};

@Injectable()
export class SchoolErpExtendedService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private payment: PaymentService,
    private config: ConfigService,
  ) {}

  private async sendSms(to: string, message: string) {
    const webhook = this.config.get<string>('SMS_WEBHOOK_URL');
    if (!webhook) return;
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
    }).catch(() => {});
  }

  private parseDate(value: string): Date {
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
    return d;
  }

  private decimal(n: number | string) {
    return new Prisma.Decimal(n);
  }

  private async nextSeq(tenantId: string, prefix: string): Promise<string> {
    const count = await this.prisma.studentCertificate.count({ where: { tenantId } });
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${count + 1}`;
  }

  // ─── Public Admission (no auth) ───────────────────────────────

  async publicCreateEnquiry(tenantSlug: string, body: Record<string, string>) {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug: tenantSlug, isActive: true } });
    if (!tenant) throw new NotFoundException('School not found');
    return this.prisma.admissionEnquiry.create({
      data: {
        tenantId: tenant.id,
        studentName: body.studentName,
        parentName: body.parentName,
        phone: body.phone,
        email: body.email,
        classApplied: body.classApplied,
        source: body.source ?? 'WEBSITE',
        notes: body.notes,
      },
    });
  }

  async publicCreateApplication(tenantSlug: string, body: Record<string, unknown>) {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug: tenantSlug, isActive: true } });
    if (!tenant) throw new NotFoundException('School not found');
    const count = await this.prisma.admissionApplication.count({ where: { tenantId: tenant.id } });
    const applicationNo = `APP-${Date.now().toString(36).toUpperCase()}-${count + 1}`;
    return this.prisma.admissionApplication.create({
      data: {
        tenantId: tenant.id,
        applicationNo,
        studentName: body.studentName as string,
        dateOfBirth: body.dateOfBirth ? this.parseDate(body.dateOfBirth as string) : null,
        gender: body.gender as string | undefined,
        parentName: body.parentName as string,
        parentPhone: body.parentPhone as string,
        parentEmail: body.parentEmail as string | undefined,
        address: body.address as string | undefined,
        classApplied: body.classApplied as string,
        previousSchool: body.previousSchool as string | undefined,
        status: 'SUBMITTED',
      },
    });
  }

  async enrollFromApplication(tenantId: string, applicationId: string, batchId: string, userId: string) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId, status: 'APPROVED' },
    });
    if (!app) throw new BadRequestException('Application not found or not approved');

    const existing = await this.prisma.candidate.findFirst({ where: { tenantId, user: { email: app.parentEmail ?? '' } } });
    if (existing && app.candidateId) {
      await this.prisma.batchEnrollment.upsert({
        where: { batchId_candidateId: { batchId, candidateId: app.candidateId } },
        create: { batchId, candidateId: app.candidateId },
        update: {},
      });
      await this.prisma.admissionApplication.update({
        where: { id: applicationId },
        data: { status: 'ENROLLED' },
      });
      return existing;
    }

    throw new BadRequestException('Manual enrollment required: create student account and link application');
  }

  // ─── Departments & Branches ───────────────────────────────────

  async listDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      include: { head: { select: { firstName: true, lastName: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(tenantId: string, body: { name: string; code: string; description?: string; headId?: string }) {
    return this.prisma.department.create({ data: { tenantId, ...body } });
  }

  async listBranches(tenantId: string) {
    return this.prisma.branch.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async createBranch(tenantId: string, body: { name: string; code: string; address?: string; phone?: string; email?: string; isMain?: boolean }) {
    if (body.isMain) {
      await this.prisma.branch.updateMany({ where: { tenantId, isMain: true }, data: { isMain: false } });
    }
    return this.prisma.branch.create({ data: { tenantId, ...body } });
  }

  // ─── Fees Extended ────────────────────────────────────────────

  async listDefaulters(tenantId: string) {
    const today = new Date();
    return this.prisma.feeInvoice.findMany({
      where: {
        tenantId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueDate: { lt: today },
      },
      include: {
        candidate: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getDailyCollection(tenantId: string, date?: string) {
    const d = date ? this.parseDate(date) : new Date();
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    const payments = await this.prisma.feePayment.findMany({
      where: { paidAt: { gte: d, lt: next }, invoice: { tenantId } },
      include: { invoice: { include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
    });
    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    return { date: d.toISOString().slice(0, 10), total, count: payments.length, payments };
  }

  async createScholarship(tenantId: string, body: { candidateId: string; name: string; discountType?: string; discountValue: number; academicYearId?: string; remarks?: string }) {
    return this.prisma.feeScholarship.create({
      data: {
        tenantId,
        candidateId: body.candidateId,
        name: body.name,
        discountType: body.discountType ?? 'PERCENT',
        discountValue: this.decimal(body.discountValue),
        academicYearId: body.academicYearId,
        remarks: body.remarks,
      },
    });
  }

  async listScholarships(tenantId: string, candidateId?: string) {
    return this.prisma.feeScholarship.findMany({
      where: { tenantId, isActive: true, ...(candidateId ? { candidateId } : {}) },
      include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  async generateInvoicesForBatch(tenantId: string, batchId: string, feeStructureId: string) {
    const structure = await this.prisma.feeStructure.findFirst({
      where: { id: feeStructureId, tenantId },
      include: { lines: true },
    });
    if (!structure) throw new NotFoundException('Fee structure not found');

    const enrollments = await this.prisma.batchEnrollment.findMany({
      where: { batchId },
      include: { candidate: true },
    });

    const invoices = [];
    for (const en of enrollments) {
      let discount = 0;
      const scholarships = await this.prisma.feeScholarship.findMany({
        where: { tenantId, candidateId: en.candidateId, isActive: true },
      });
      for (const s of scholarships) {
        if (s.discountType === 'PERCENT') discount += Number(structure.totalAmount) * (Number(s.discountValue) / 100);
        else discount += Number(s.discountValue);
      }

      const count = await this.prisma.feeInvoice.count({ where: { tenantId } });
      const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}-${count + 1}`;
      const dueDate = structure.lines[0]?.dueDate ?? new Date();

      const inv = await this.prisma.feeInvoice.create({
        data: {
          tenantId,
          invoiceNo,
          candidateId: en.candidateId,
          feeStructureId,
          totalAmount: structure.totalAmount,
          discountAmount: this.decimal(Math.min(discount, Number(structure.totalAmount))),
          dueDate,
          status: 'ISSUED',
        },
      });
      invoices.push(inv);
    }
    return { generated: invoices.length, invoices };
  }

  async syncOverdueInvoices(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.feeInvoice.updateMany({
      where: {
        tenantId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE' },
    });
  }

  async createPaymentOrder(tenantId: string, invoiceId: string) {
    await this.syncOverdueInvoices(tenantId);
    const invoice = await this.prisma.feeInvoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const balance = Number(invoice.totalAmount) - Number(invoice.discountAmount) - Number(invoice.paidAmount);
    if (balance <= 0) throw new BadRequestException('Invoice already paid');

    const rzOrder = await this.payment.createRazorpayOrder({
      amountInr: balance,
      receipt: invoice.invoiceNo,
      notes: { invoiceId, tenantId },
    });

    const order = await this.prisma.onlinePaymentOrder.create({
      data: {
        tenantId,
        invoiceId,
        amount: this.decimal(balance),
        gatewayOrderId: rzOrder.id,
        status: 'CREATED',
      },
    });
    return {
      orderId: order.id,
      gatewayOrderId: rzOrder.id,
      amount: balance,
      currency: 'INR',
      razorpayKeyId: this.payment.getKeyId(),
      mock: !this.payment.isConfigured(),
    };
  }

  async verifyPaymentOrder(
    tenantId: string,
    orderId: string,
    userId: string,
    razorpayPaymentId?: string,
    razorpaySignature?: string,
  ) {
    const order = await this.prisma.onlinePaymentOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { invoice: true },
    });
    if (!order) throw new NotFoundException('Payment order not found');
    if (order.status === 'PAID') {
      return { success: true, alreadyPaid: true, receiptNo: null };
    }

    if (order.gatewayOrderId && razorpayPaymentId && razorpaySignature) {
      const valid = this.payment.verifyRazorpaySignature(
        order.gatewayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      );
      if (!valid) throw new BadRequestException('Invalid payment signature');
    }

    await this.prisma.onlinePaymentOrder.update({
      where: { id: orderId },
      data: {
        status: 'PAID' as OnlinePaymentStatus,
        paidAt: new Date(),
        metadata: razorpayPaymentId ? { razorpayPaymentId } : undefined,
      },
    });

    const receiptNo = `RCP-ONLINE-${Date.now().toString(36).toUpperCase()}`;
    await this.prisma.feePayment.create({
      data: {
        invoiceId: order.invoiceId,
        amount: order.amount,
        method: 'ONLINE',
        referenceNo: order.gatewayOrderId,
        receiptNo,
        recordedById: userId,
      },
    });

    const invoice = order.invoice;
    const newPaid = invoice.paidAmount.add(order.amount);
    const balance = invoice.totalAmount.sub(invoice.discountAmount).sub(newPaid);
    await this.prisma.feeInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: newPaid, status: balance.lte(0) ? 'PAID' : 'PARTIALLY_PAID' },
    });

    const payment = await this.prisma.feePayment.findFirst({
      where: { invoiceId: order.invoiceId, receiptNo },
    });
    return { success: true, receiptNo, paymentId: payment?.id };
  }

  // ─── Staff Attendance ─────────────────────────────────────────

  async markStaffAttendance(body: { staffId: string; date: string; status?: AttendanceStatus; checkIn?: string; checkOut?: string }) {
    return this.prisma.staffAttendance.upsert({
      where: { staffId_date: { staffId: body.staffId, date: this.parseDate(body.date) } },
      create: {
        staffId: body.staffId,
        date: this.parseDate(body.date),
        status: body.status ?? 'PRESENT',
        checkIn: body.checkIn,
        checkOut: body.checkOut,
      },
      update: { status: body.status, checkIn: body.checkIn, checkOut: body.checkOut },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  async listStaffAttendance(tenantId: string, date?: string) {
    return this.prisma.staffAttendance.findMany({
      where: {
        staff: { tenantId },
        ...(date ? { date: this.parseDate(date) } : {}),
      },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { date: 'desc' },
    });
  }

  // ─── Student Leave ────────────────────────────────────────────

  async applyStudentLeave(tenantId: string, userId: string, body: { candidateId: string; startDate: string; endDate: string; reason?: string }) {
    return this.prisma.studentLeaveApplication.create({
      data: {
        tenantId,
        candidateId: body.candidateId,
        startDate: this.parseDate(body.startDate),
        endDate: this.parseDate(body.endDate),
        reason: body.reason,
        applicantId: userId,
        status: 'PENDING',
      },
    });
  }

  async listStudentLeave(tenantId: string, status?: string) {
    return this.prisma.studentLeaveApplication.findMany({
      where: { tenantId, ...(status ? { status: status as StudentLeaveStatus } : {}) },
      include: {
        candidate: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveStudentLeave(userId: string, id: string, approved: boolean) {
    return this.prisma.studentLeaveApplication.update({
      where: { id },
      data: { status: approved ? 'APPROVED' : 'REJECTED', approvedById: userId, approvedAt: new Date() },
    });
  }

  // ─── Promotions & Alumni ──────────────────────────────────────

  async promoteStudents(tenantId: string, userId: string, body: { candidateIds: string[]; fromBatchId: string; toBatchId: string; academicYearId: string; remarks?: string }) {
    const results = [];
    for (const candidateId of body.candidateIds) {
      await this.prisma.batchEnrollment.updateMany({
        where: { candidateId, batchId: body.fromBatchId },
        data: { batchId: body.toBatchId },
      });
      const promo = await this.prisma.studentPromotion.create({
        data: {
          tenantId,
          candidateId,
          fromBatchId: body.fromBatchId,
          toBatchId: body.toBatchId,
          academicYearId: body.academicYearId,
          promotedById: userId,
          remarks: body.remarks,
        },
      });
      results.push(promo);
    }
    return { promoted: results.length, records: results };
  }

  async markAlumni(tenantId: string, candidateId: string, body: { graduationYear: number; lastBatch?: string; currentOccupation?: string; contactEmail?: string; contactPhone?: string }) {
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { studentStatus: 'ALUMNI' },
    });
    return this.prisma.alumniRecord.upsert({
      where: { candidateId },
      create: { tenantId, candidateId, ...body },
      update: body,
    });
  }

  async listAlumni(tenantId: string) {
    return this.prisma.alumniRecord.findMany({
      where: { tenantId },
      include: { candidate: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
      orderBy: { graduationYear: 'desc' },
    });
  }

  // ─── Certificates ─────────────────────────────────────────────

  async issueCertificate(tenantId: string, userId: string, body: { candidateId: string; type: CertificateType; title: string; data?: Record<string, unknown>; validUntil?: string }) {
    const certNo = await this.nextSeq(tenantId, body.type.slice(0, 3));
    return this.prisma.studentCertificate.create({
      data: {
        tenantId,
        candidateId: body.candidateId,
        type: body.type,
        title: body.title,
        certificateNo: certNo,
        data: body.data as Prisma.InputJsonValue,
        validUntil: body.validUntil ? this.parseDate(body.validUntil) : null,
        issuedById: userId,
      },
      include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  async listCertificates(tenantId: string, candidateId?: string) {
    return this.prisma.studentCertificate.findMany({
      where: { tenantId, ...(candidateId ? { candidateId } : {}) },
      include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ─── Board Grading Config ─────────────────────────────────────

  async listGradingConfigs(tenantId: string) {
    return this.prisma.gradingBoardConfig.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async upsertGradingConfig(tenantId: string, body: { name: string; boardType?: BoardType; gradeRules?: Record<string, unknown>; isDefault?: boolean }) {
    if (body.isDefault) {
      await this.prisma.gradingBoardConfig.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
    }
    const existing = await this.prisma.gradingBoardConfig.findFirst({ where: { tenantId, name: body.name } });
    const data = {
      boardType: body.boardType ?? 'CBSE',
      gradeRules: (body.gradeRules ?? DEFAULT_GRADE_RULES) as Prisma.InputJsonValue,
      isDefault: body.isDefault ?? false,
    };
    if (existing) {
      return this.prisma.gradingBoardConfig.update({ where: { id: existing.id }, data });
    }
    return this.prisma.gradingBoardConfig.create({ data: { tenantId, name: body.name, ...data } });
  }

  gradeFromConfig(rules: Record<string, { min: number; max: number }>, percentage: number): string {
    for (const [grade, range] of Object.entries(rules)) {
      if (percentage >= range.min && percentage <= range.max) return grade.replace('_', '+');
    }
    return 'F';
  }

  // ─── Transport Extended ───────────────────────────────────────

  async listVehicles(tenantId: string) {
    return this.prisma.transportVehicle.findMany({
      where: { tenantId, isActive: true },
      include: { route: true, maintenanceRecords: { orderBy: { date: 'desc' }, take: 3 } },
    });
  }

  async createVehicle(tenantId: string, body: { registration: string; routeId?: string; capacity?: number; driverName?: string; driverPhone?: string }) {
    return this.prisma.transportVehicle.create({ data: { tenantId, ...body } });
  }

  async recordVehicleMaintenance(body: { vehicleId: string; date: string; description: string; cost?: number; nextDueDate?: string }) {
    return this.prisma.vehicleMaintenance.create({
      data: {
        vehicleId: body.vehicleId,
        date: this.parseDate(body.date),
        description: body.description,
        cost: this.decimal(body.cost ?? 0),
        nextDueDate: body.nextDueDate ? this.parseDate(body.nextDueDate) : null,
      },
    });
  }

  async getDriverRoute(tenantId: string, driverPhone: string) {
    const vehicle = await this.prisma.transportVehicle.findFirst({
      where: { tenantId, driverPhone, isActive: true },
      include: {
        route: {
          include: {
            stops: { orderBy: { sequence: 'asc' } },
            assignments: { include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } } },
          },
        },
      },
    });
    if (!vehicle?.route) throw new NotFoundException('No route assigned');
    return vehicle;
  }

  // ─── Inventory Extended ───────────────────────────────────────

  async listSuppliers(tenantId: string) {
    return this.prisma.supplier.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async createSupplier(tenantId: string, body: { name: string; contact?: string; phone?: string; email?: string; address?: string }) {
    return this.prisma.supplier.create({ data: { tenantId, ...body } });
  }

  async createPurchaseOrder(tenantId: string, body: { supplierId: string; items: unknown[]; totalAmount: number }) {
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const orderNo = `PO-${Date.now().toString(36).toUpperCase()}-${count + 1}`;
    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: body.supplierId,
        orderNo,
        items: body.items as Prisma.InputJsonValue,
        totalAmount: this.decimal(body.totalAmount),
        status: 'DRAFT',
      },
      include: { supplier: true },
    });
  }

  async listPurchaseOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Hostel Visitor Pass ──────────────────────────────────────

  async createVisitorPass(body: { candidateId: string; visitorName: string; visitorPhone?: string; relation?: string; visitDate: string; visitTime?: string; purpose?: string }) {
    return this.prisma.hostelVisitorPass.create({ data: { ...body, visitDate: this.parseDate(body.visitDate) } });
  }

  async listVisitorPasses(candidateId?: string) {
    return this.prisma.hostelVisitorPass.findMany({
      where: candidateId ? { candidateId } : {},
      include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { visitDate: 'desc' },
    });
  }

  // ─── Timetable Substitute ─────────────────────────────────────

  async assignSubstitute(tenantId: string, body: { timetableSlotId: string; originalTeacherId: string; substituteTeacherId: string; date: string; remarks?: string }) {
    return this.prisma.substituteAssignment.create({
      data: {
        tenantId,
        timetableSlotId: body.timetableSlotId,
        originalTeacherId: body.originalTeacherId,
        substituteTeacherId: body.substituteTeacherId,
        date: this.parseDate(body.date),
        remarks: body.remarks,
      },
      include: {
        originalTeacher: { select: { firstName: true, lastName: true } },
        substituteTeacher: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async detectTimetableClashes(tenantId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: { tenantId, teacherId: { not: null } },
      include: { batch: true, subject: true, teacher: { select: { firstName: true, lastName: true } } },
    });
    const clashes: { teacherId: string; teacherName: string; dayOfWeek: string; periodNumber: number; slots: string[] }[] = [];
    const byKey = new Map<string, typeof slots>();
    for (const s of slots) {
      const key = `${s.teacherId}-${s.dayOfWeek}-${s.periodNumber}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(s);
    }
    for (const [, group] of byKey) {
      if (group.length > 1) {
        clashes.push({
          teacherId: group[0].teacherId!,
          teacherName: `${group[0].teacher!.firstName} ${group[0].teacher!.lastName}`,
          dayOfWeek: group[0].dayOfWeek,
          periodNumber: group[0].periodNumber,
          slots: group.map((s) => `${s.batch.name} - ${s.subject.name}`),
        });
      }
    }
    return clashes;
  }

  // ─── Notifications Automation ─────────────────────────────────

  async notifyAbsentStudents(tenantId: string, batchId: string, date: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, batchId, date: this.parseDate(date), status: 'ABSENT' },
      include: { candidate: { include: { user: true, parentLinks: { include: { parent: true } } } } },
    });
    const sent = [];
    for (const r of records) {
      for (const link of r.candidate.parentLinks) {
        const msg = `${r.candidate.user.firstName} was absent on ${date}.`;
        await this.prisma.notificationLog.create({
          data: { tenantId, channel: 'IN_APP', recipient: link.parent.email, subject: 'Absence Alert', body: msg, status: 'SENT', sentAt: new Date() },
        });
        if (link.parent.email) {
          await this.mail.send(link.parent.email, 'Absence Alert', `<p>${msg}</p>`).catch(() => {});
        }
        if (link.parent.phone) await this.sendSms(link.parent.phone, msg);
        sent.push({ parent: link.parent.email, student: r.candidate.user.firstName });
      }
    }
    return { notified: sent.length, details: sent };
  }

  async notifyFeeDefaulters(tenantId: string) {
    const defaulters = await this.listDefaulters(tenantId);
    const sent = [];
    for (const inv of defaulters) {
      const balance = Number(inv.totalAmount) - Number(inv.discountAmount) - Number(inv.paidAmount);
      const email = inv.candidate.user.email;
      const msg = `Fee reminder: ₹${balance.toLocaleString()} outstanding for invoice ${inv.invoiceNo}.`;
      await this.prisma.notificationLog.create({
        data: { tenantId, channel: 'EMAIL', recipient: email, subject: 'Fee Reminder', body: msg, status: 'SENT', sentAt: new Date() },
      });
      await this.mail.send(email, 'Fee Reminder', `<p>${msg}</p>`).catch(() => {});
      const phone = inv.candidate.user.phone;
      if (phone) await this.sendSms(phone, msg);
      sent.push(email);
    }
    return { notified: sent.length };
  }

  // ─── Comprehensive Reports ────────────────────────────────────

  async getSchoolReports(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalStudents,
      activeStudents,
      alumniCount,
      newAdmissions,
      todayAttendance,
      totalAttendanceToday,
      feeSummary,
      defaulterCount,
      todayCollection,
      staffCount,
      lowAttendanceStudents,
      topPerformers,
    ] = await Promise.all([
      this.prisma.candidate.count({ where: { tenantId } }),
      this.prisma.candidate.count({ where: { tenantId, studentStatus: 'ACTIVE' } }),
      this.prisma.alumniRecord.count({ where: { tenantId } }),
      this.prisma.admissionApplication.count({ where: { tenantId, status: 'ENROLLED', createdAt: { gte: new Date(today.getFullYear(), 0, 1) } } }),
      this.prisma.attendanceRecord.count({ where: { tenantId, date: today, status: 'PRESENT' } }),
      this.prisma.attendanceRecord.count({ where: { tenantId, date: today } }),
      this.prisma.feeInvoice.aggregate({ where: { tenantId }, _sum: { totalAmount: true, paidAmount: true, discountAmount: true } }),
      this.prisma.feeInvoice.count({ where: { tenantId, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lt: today } } }),
      this.prisma.feePayment.aggregate({ where: { paidAt: { gte: today, lt: tomorrow }, invoice: { tenantId } }, _sum: { amount: true }, _count: true }),
      this.prisma.staffProfile.count({ where: { tenantId } }),
      this.getLowAttendanceStudents(tenantId),
      this.getTopPerformers(tenantId),
    ]);

    const totalDue = Number(feeSummary._sum.totalAmount ?? 0) - Number(feeSummary._sum.discountAmount ?? 0);
    const totalPaid = Number(feeSummary._sum.paidAmount ?? 0);

    return {
      students: { total: totalStudents, active: activeStudents, alumni: alumniCount, newAdmissions },
      attendance: {
        todayPresent: todayAttendance,
        todayTotal: totalAttendanceToday,
        todayPercent: totalAttendanceToday > 0 ? Math.round((todayAttendance / totalAttendanceToday) * 100) : 0,
        lowAttendanceStudents,
      },
      finance: {
        totalDue,
        totalPaid,
        outstanding: totalDue - totalPaid,
        defaulterCount,
        todayCollection: Number(todayCollection._sum.amount ?? 0),
        todayPaymentCount: todayCollection._count,
      },
      academics: { topPerformers },
      staff: { total: staffCount },
    };
  }

  private async getLowAttendanceStudents(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const records = await this.prisma.attendanceRecord.groupBy({
      by: ['candidateId', 'status'],
      where: { tenantId, date: { gte: thirtyDaysAgo } },
      _count: true,
    });
    const byCandidate = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      if (!byCandidate.has(r.candidateId)) byCandidate.set(r.candidateId, { present: 0, total: 0 });
      const entry = byCandidate.get(r.candidateId)!;
      entry.total += r._count;
      if (r.status === 'PRESENT' || r.status === 'LATE') entry.present += r._count;
    }
    const low = [];
    for (const [candidateId, stats] of byCandidate) {
      const pct = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
      if (pct < 75) {
        const c = await this.prisma.candidate.findUnique({
          where: { id: candidateId },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (c) low.push({ candidateId, name: `${c.user.firstName} ${c.user.lastName}`, attendancePercent: Math.round(pct) });
      }
    }
    return low.slice(0, 10);
  }

  private async getTopPerformers(tenantId: string) {
    const cards = await this.prisma.reportCard.findMany({
      where: { tenantId, status: 'PUBLISHED' },
      include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { percentage: 'desc' },
      take: 10,
    });
    return cards.map((c) => ({
      name: `${c.candidate.user.firstName} ${c.candidate.user.lastName}`,
      percentage: Number(c.percentage),
      grade: c.overallGrade,
    }));
  }
}
