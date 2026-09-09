import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  FeeInvoiceStatus,
  AdmissionEnquiryStatus,
  AdmissionApplicationStatus,
  LeaveStatus,
  LibraryIssueStatus,
  ReportCardStatus,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchoolErpService {
  constructor(private prisma: PrismaService) {}

  private parseDate(value: string): Date {
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
    return d;
  }

  private decimal(n: number | string) {
    return new Prisma.Decimal(n);
  }

  private async nextSeq(tenantId: string, prefix: string): Promise<string> {
    const count = await this.prisma.feeInvoice.count({ where: { tenantId } });
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${count + 1}`;
  }

  // ─── Academic Year & Calendar ────────────────────────────────

  async listAcademicYears(tenantId: string) {
    return this.prisma.academicYear.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
      include: { terms: { orderBy: { termNumber: 'asc' } } },
    });
  }

  async createAcademicYear(
    tenantId: string,
    body: { name: string; startDate: string; endDate: string; isCurrent?: boolean },
  ) {
    if (body.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false, status: 'CLOSED' },
      });
    }
    return this.prisma.academicYear.create({
      data: {
        tenantId,
        name: body.name,
        startDate: this.parseDate(body.startDate),
        endDate: this.parseDate(body.endDate),
        isCurrent: body.isCurrent ?? false,
        status: body.isCurrent ? 'ACTIVE' : 'UPCOMING',
      },
    });
  }

  async listCalendarEvents(tenantId: string, from?: string, to?: string) {
    const where: Prisma.CalendarEventWhereInput = { tenantId };
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate.gte = this.parseDate(from);
      if (to) where.startDate.lte = this.parseDate(to);
    }
    return this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  async createCalendarEvent(
    tenantId: string,
    body: {
      title: string;
      description?: string;
      eventType?: string;
      startDate: string;
      endDate?: string;
      isHoliday?: boolean;
      academicYearId?: string;
    },
  ) {
    return this.prisma.calendarEvent.create({
      data: {
        tenantId,
        title: body.title,
        description: body.description,
        eventType: (body.eventType as never) ?? 'EVENT',
        startDate: this.parseDate(body.startDate),
        endDate: body.endDate ? this.parseDate(body.endDate) : null,
        isHoliday: body.isHoliday ?? false,
        academicYearId: body.academicYearId,
      },
    });
  }

  // ─── Admissions ────────────────────────────────────────────────

  async listEnquiries(tenantId: string, status?: string) {
    return this.prisma.admissionEnquiry.findMany({
      where: { tenantId, ...(status ? { status: status as AdmissionEnquiryStatus } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { handledBy: { select: { firstName: true, lastName: true } } },
    });
  }

  async createEnquiry(tenantId: string, body: Record<string, string>) {
    return this.prisma.admissionEnquiry.create({
      data: {
        tenantId,
        studentName: body.studentName,
        parentName: body.parentName,
        phone: body.phone,
        email: body.email,
        classApplied: body.classApplied,
        source: body.source,
        notes: body.notes,
      },
    });
  }

  async updateEnquiryStatus(tenantId: string, id: string, status: AdmissionEnquiryStatus) {
    const row = await this.prisma.admissionEnquiry.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Enquiry not found');
    return this.prisma.admissionEnquiry.update({ where: { id }, data: { status } });
  }

  async listApplications(tenantId: string, status?: string) {
    return this.prisma.admissionApplication.findMany({
      where: { tenantId, ...(status ? { status: status as AdmissionApplicationStatus } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { academicYear: true, candidate: { include: { user: { select: { email: true } } } } },
    });
  }

  async createApplication(tenantId: string, body: Record<string, unknown>) {
    const applicationNo = await this.nextSeq(tenantId, 'APP');
    return this.prisma.admissionApplication.create({
      data: {
        tenantId,
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
        academicYearId: body.academicYearId as string | undefined,
        enquiryId: body.enquiryId as string | undefined,
        status: 'SUBMITTED',
      },
    });
  }

  async updateApplicationStatus(
    tenantId: string,
    id: string,
    status: AdmissionApplicationStatus,
    remarks?: string,
  ) {
    const app = await this.prisma.admissionApplication.findFirst({ where: { id, tenantId } });
    if (!app) throw new NotFoundException('Application not found');
    return this.prisma.admissionApplication.update({
      where: { id },
      data: { status, remarks },
    });
  }

  // ─── Fees ──────────────────────────────────────────────────────

  async listFeeHeads(tenantId: string) {
    return this.prisma.feeHead.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async createFeeHead(tenantId: string, body: { name: string; code: string; description?: string }) {
    return this.prisma.feeHead.create({ data: { tenantId, ...body } });
  }

  async listFeeStructures(tenantId: string) {
    return this.prisma.feeStructure.findMany({
      where: { tenantId, isActive: true },
      include: { lines: { include: { feeHead: true } }, academicYear: true, batch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFeeStructure(
    tenantId: string,
    body: {
      name: string;
      academicYearId: string;
      batchId?: string;
      lines: { feeHeadId: string; amount: number; dueDate?: string }[];
    },
  ) {
    const total = body.lines.reduce((s, l) => s + l.amount, 0);
    return this.prisma.feeStructure.create({
      data: {
        tenantId,
        name: body.name,
        academicYearId: body.academicYearId,
        batchId: body.batchId,
        totalAmount: this.decimal(total),
        lines: {
          create: body.lines.map((l) => ({
            feeHeadId: l.feeHeadId,
            amount: this.decimal(l.amount),
            dueDate: l.dueDate ? this.parseDate(l.dueDate) : null,
          })),
        },
      },
      include: { lines: { include: { feeHead: true } } },
    });
  }

  async listFeeInvoices(tenantId: string, candidateId?: string) {
    return this.prisma.feeInvoice.findMany({
      where: { tenantId, ...(candidateId ? { candidateId } : {}) },
      include: {
        candidate: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        payments: true,
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  async createFeeInvoice(
    tenantId: string,
    body: { candidateId: string; totalAmount: number; dueDate: string; feeStructureId?: string; discountAmount?: number },
  ) {
    const invoiceNo = await this.nextSeq(tenantId, 'INV');
    return this.prisma.feeInvoice.create({
      data: {
        tenantId,
        invoiceNo,
        candidateId: body.candidateId,
        feeStructureId: body.feeStructureId,
        totalAmount: this.decimal(body.totalAmount),
        discountAmount: this.decimal(body.discountAmount ?? 0),
        dueDate: this.parseDate(body.dueDate),
        status: 'ISSUED',
      },
    });
  }

  async recordFeePayment(
    tenantId: string,
    userId: string,
    body: { invoiceId: string; amount: number; method?: string; referenceNo?: string; remarks?: string },
  ) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: body.invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const receiptNo = await this.nextSeq(tenantId, 'RCP');
    const payment = await this.prisma.feePayment.create({
      data: {
        invoiceId: body.invoiceId,
        amount: this.decimal(body.amount),
        method: (body.method as never) ?? 'CASH',
        referenceNo: body.referenceNo,
        receiptNo,
        remarks: body.remarks,
        recordedById: userId,
      },
    });

    const newPaid = invoice.paidAmount.add(this.decimal(body.amount));
    const balance = invoice.totalAmount.sub(invoice.discountAmount).sub(newPaid);
    let status: FeeInvoiceStatus = 'PARTIALLY_PAID';
    if (balance.lte(0)) status = 'PAID';
    else if (newPaid.eq(0)) status = 'ISSUED';

    await this.prisma.feeInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: newPaid, status },
    });

    return payment;
  }

  private async gradeFromBoard(tenantId: string, percentage: number): Promise<string> {
    const config = await this.prisma.gradingBoardConfig.findFirst({
      where: { tenantId, isDefault: true },
    });
    const rules = (config?.gradeRules ?? {
      'A+': { min: 90, max: 100 },
      A: { min: 80, max: 89 },
      'B+': { min: 70, max: 79 },
      B: { min: 60, max: 69 },
      C: { min: 50, max: 59 },
      D: { min: 40, max: 49 },
      F: { min: 0, max: 39 },
    }) as Record<string, { min: number; max: number }>;
    for (const [grade, range] of Object.entries(rules)) {
      if (percentage >= range.min && percentage <= range.max) return grade;
    }
    return 'F';
  }

  async getFeeSummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.feeInvoice.updateMany({
      where: { tenantId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    });
    const invoices = await this.prisma.feeInvoice.findMany({ where: { tenantId } });
    const totalDue = invoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.discountAmount), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const overdue = invoices.filter((i) => i.status === 'OVERDUE' || (i.status === 'ISSUED' && i.dueDate < new Date())).length;
    return { totalDue, totalPaid, outstanding: totalDue - totalPaid, overdueCount: overdue, invoiceCount: invoices.length };
  }

  // ─── Report Cards ──────────────────────────────────────────────

  async listTerms(tenantId: string) {
    return this.prisma.academicTerm.findMany({
      where: { tenantId },
      include: { academicYear: true },
      orderBy: [{ academicYearId: 'desc' }, { termNumber: 'asc' }],
    });
  }

  async createTerm(
    tenantId: string,
    body: { academicYearId: string; name: string; termNumber: number; startDate: string; endDate: string; isCurrent?: boolean },
  ) {
    if (body.isCurrent) {
      await this.prisma.academicTerm.updateMany({ where: { tenantId, isCurrent: true }, data: { isCurrent: false } });
    }
    return this.prisma.academicTerm.create({
      data: {
        tenantId,
        academicYearId: body.academicYearId,
        name: body.name,
        termNumber: body.termNumber,
        startDate: this.parseDate(body.startDate),
        endDate: this.parseDate(body.endDate),
        isCurrent: body.isCurrent ?? false,
      },
    });
  }

  async upsertGradeEntry(
    tenantId: string,
    userId: string,
    body: { termId: string; candidateId: string; subjectId: string; maxMarks?: number; marksObtained: number; grade?: string; remarks?: string },
  ) {
    const maxMarks = body.maxMarks ?? 100;
    const pct = (body.marksObtained / maxMarks) * 100;
    const grade = body.grade ?? await this.gradeFromBoard(tenantId, pct);
    return this.prisma.gradeEntry.upsert({
      where: { termId_candidateId_subjectId: { termId: body.termId, candidateId: body.candidateId, subjectId: body.subjectId } },
      create: {
        tenantId,
        termId: body.termId,
        candidateId: body.candidateId,
        subjectId: body.subjectId,
        maxMarks: this.decimal(maxMarks),
        marksObtained: this.decimal(body.marksObtained),
        grade,
        remarks: body.remarks,
        enteredById: userId,
      },
      update: {
        marksObtained: this.decimal(body.marksObtained),
        maxMarks: this.decimal(maxMarks),
        grade,
        remarks: body.remarks,
        enteredById: userId,
      },
      include: { subject: true, candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  async listGradeEntries(tenantId: string, termId: string, candidateId?: string) {
    return this.prisma.gradeEntry.findMany({
      where: { tenantId, termId, ...(candidateId ? { candidateId } : {}) },
      include: { subject: true, candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  async generateReportCard(tenantId: string, userId: string, termId: string, candidateId: string) {
    const entries = await this.prisma.gradeEntry.findMany({ where: { tenantId, termId, candidateId } });
    if (!entries.length) throw new BadRequestException('No grade entries found');

    const totalMarks = entries.reduce((s, e) => s + Number(e.marksObtained), 0);
    const maxMarks = entries.reduce((s, e) => s + Number(e.maxMarks), 0);
    const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
    const overallGrade = await this.gradeFromBoard(tenantId, percentage);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const attRecords = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, candidateId, date: { gte: thirtyDaysAgo } },
    });
    const present = attRecords.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attendancePct = attRecords.length > 0 ? (present / attRecords.length) * 100 : null;

    return this.prisma.reportCard.upsert({
      where: { termId_candidateId: { termId, candidateId } },
      create: {
        tenantId,
        termId,
        candidateId,
        totalMarks: this.decimal(totalMarks),
        maxMarks: this.decimal(maxMarks),
        percentage: this.decimal(Math.round(percentage * 100) / 100),
        overallGrade,
        attendancePct: attendancePct != null ? this.decimal(Math.round(attendancePct * 100) / 100) : null,
        status: 'PUBLISHED',
        issuedById: userId,
        issuedAt: new Date(),
      },
      update: {
        totalMarks: this.decimal(totalMarks),
        maxMarks: this.decimal(maxMarks),
        percentage: this.decimal(Math.round(percentage * 100) / 100),
        overallGrade,
        attendancePct: attendancePct != null ? this.decimal(Math.round(attendancePct * 100) / 100) : null,
        status: 'PUBLISHED',
        issuedById: userId,
        issuedAt: new Date(),
      },
      include: {
        term: { include: { academicYear: true } },
        candidate: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async listReportCards(tenantId: string, candidateId?: string) {
    return this.prisma.reportCard.findMany({
      where: { tenantId, ...(candidateId ? { candidateId } : {}) },
      include: {
        term: { include: { academicYear: true } },
        candidate: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Transport ─────────────────────────────────────────────────

  async listTransportRoutes(tenantId: string) {
    return this.prisma.transportRoute.findMany({
      where: { tenantId, isActive: true },
      include: { stops: { orderBy: { sequence: 'asc' } }, vehicles: true, _count: { select: { assignments: true } } },
    });
  }

  async createTransportRoute(
    tenantId: string,
    body: { name: string; code: string; startPoint: string; endPoint: string; monthlyFee?: number; stops?: { name: string; sequence: number; pickUpTime?: string }[] },
  ) {
    return this.prisma.transportRoute.create({
      data: {
        tenantId,
        name: body.name,
        code: body.code,
        startPoint: body.startPoint,
        endPoint: body.endPoint,
        monthlyFee: this.decimal(body.monthlyFee ?? 0),
        stops: body.stops?.length
          ? { create: body.stops.map((s) => ({ name: s.name, sequence: s.sequence, pickUpTime: s.pickUpTime })) }
          : undefined,
      },
      include: { stops: true },
    });
  }

  async assignTransport(body: { candidateId: string; routeId: string; stopId?: string; startDate: string }) {
    return this.prisma.transportAssignment.upsert({
      where: { candidateId: body.candidateId },
      create: {
        candidateId: body.candidateId,
        routeId: body.routeId,
        stopId: body.stopId,
        startDate: this.parseDate(body.startDate),
      },
      update: { routeId: body.routeId, stopId: body.stopId, startDate: this.parseDate(body.startDate) },
      include: { route: { include: { stops: true } }, candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  // ─── Library ───────────────────────────────────────────────────

  async listLibraryBooks(tenantId: string, search?: string) {
    return this.prisma.libraryBook.findMany({
      where: {
        tenantId,
        ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { author: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { title: 'asc' },
    });
  }

  async createLibraryBook(tenantId: string, body: { title: string; author?: string; isbn?: string; category?: string; totalCopies?: number; shelfLocation?: string }) {
    const copies = body.totalCopies ?? 1;
    return this.prisma.libraryBook.create({
      data: { tenantId, title: body.title, author: body.author, isbn: body.isbn, category: body.category, totalCopies: copies, available: copies, shelfLocation: body.shelfLocation },
    });
  }

  async issueBook(userId: string, body: { bookId: string; candidateId: string; dueDate: string }) {
    const book = await this.prisma.libraryBook.findUnique({ where: { id: body.bookId } });
    if (!book || book.available <= 0) throw new BadRequestException('Book not available');
    await this.prisma.libraryBook.update({ where: { id: body.bookId }, data: { available: { decrement: 1 } } });
    return this.prisma.libraryIssue.create({
      data: {
        bookId: body.bookId,
        candidateId: body.candidateId,
        dueDate: this.parseDate(body.dueDate),
        issuedById: userId,
        status: 'ISSUED',
      },
      include: { book: true, candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  async returnBook(userId: string, issueId: string) {
    const issue = await this.prisma.libraryIssue.findUnique({ where: { id: issueId } });
    if (!issue || issue.status === 'RETURNED') throw new NotFoundException('Issue not found');
    await this.prisma.libraryBook.update({ where: { id: issue.bookId }, data: { available: { increment: 1 } } });
    return this.prisma.libraryIssue.update({
      where: { id: issueId },
      data: { status: 'RETURNED' as LibraryIssueStatus, returnedAt: new Date(), returnedById: userId },
    });
  }

  // ─── HR ────────────────────────────────────────────────────────

  async listStaff(tenantId: string) {
    return this.prisma.staffProfile.findMany({
      where: { tenantId },
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { joiningDate: 'desc' },
    });
  }

  async createStaffProfile(tenantId: string, body: { userId: string; employeeId: string; department?: string; designation?: string; joiningDate: string; basicSalary?: number }) {
    return this.prisma.staffProfile.create({
      data: {
        tenantId,
        userId: body.userId,
        employeeId: body.employeeId,
        department: body.department,
        designation: body.designation,
        joiningDate: this.parseDate(body.joiningDate),
        basicSalary: this.decimal(body.basicSalary ?? 0),
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }

  async listLeaveApplications(tenantId: string, status?: string) {
    return this.prisma.leaveApplication.findMany({
      where: {
        staff: { tenantId },
        ...(status ? { status: status as LeaveStatus } : {}),
      },
      include: {
        staff: { include: { user: { select: { firstName: true, lastName: true } } } },
        applicant: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyLeave(userId: string, body: { staffId: string; leaveType: string; startDate: string; endDate: string; reason?: string }) {
    return this.prisma.leaveApplication.create({
      data: {
        staffId: body.staffId,
        leaveType: body.leaveType as never,
        startDate: this.parseDate(body.startDate),
        endDate: this.parseDate(body.endDate),
        reason: body.reason,
        applicantId: userId,
        status: 'PENDING',
      },
    });
  }

  async approveLeave(userId: string, id: string, approved: boolean) {
    return this.prisma.leaveApplication.update({
      where: { id },
      data: { status: approved ? 'APPROVED' : 'REJECTED', approvedById: userId, approvedAt: new Date() },
    });
  }

  async generateSalarySlip(body: { staffId: string; userId: string; month: number; year: number; allowances?: number; deductions?: number }) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id: body.staffId } });
    if (!staff) throw new NotFoundException('Staff not found');
    const basic = Number(staff.basicSalary);
    const allowances = body.allowances ?? 0;
    const deductions = body.deductions ?? 0;
    const net = basic + allowances - deductions;
    return this.prisma.salarySlip.upsert({
      where: { staffId_month_year: { staffId: body.staffId, month: body.month, year: body.year } },
      create: {
        staffId: body.staffId,
        userId: body.userId,
        month: body.month,
        year: body.year,
        basicSalary: this.decimal(basic),
        allowances: this.decimal(allowances),
        deductions: this.decimal(deductions),
        netSalary: this.decimal(net),
      },
      update: {
        allowances: this.decimal(allowances),
        deductions: this.decimal(deductions),
        netSalary: this.decimal(net),
      },
    });
  }

  // ─── Hostel ────────────────────────────────────────────────────

  async listHostels(tenantId: string) {
    return this.prisma.hostel.findMany({
      where: { tenantId, isActive: true },
      include: { rooms: { include: { _count: { select: { allocations: true } } } } },
    });
  }

  async createHostel(tenantId: string, body: { name: string; address?: string; wardenName?: string; wardenPhone?: string }) {
    return this.prisma.hostel.create({ data: { tenantId, ...body } });
  }

  async createHostelRoom(body: { hostelId: string; roomNumber: string; roomType?: string; capacity?: number; monthlyFee?: number }) {
    return this.prisma.hostelRoom.create({
      data: {
        hostelId: body.hostelId,
        roomNumber: body.roomNumber,
        roomType: (body.roomType as never) ?? 'DOUBLE',
        capacity: body.capacity ?? 2,
        monthlyFee: this.decimal(body.monthlyFee ?? 0),
      },
    });
  }

  async allocateHostel(body: { candidateId: string; roomId: string; bedNumber?: string; startDate: string }) {
    const room = await this.prisma.hostelRoom.findUnique({ where: { id: body.roomId } });
    if (!room || room.occupied >= room.capacity) throw new BadRequestException('Room full');
    await this.prisma.hostelRoom.update({ where: { id: body.roomId }, data: { occupied: { increment: 1 } } });
    return this.prisma.hostelAllocation.create({
      data: {
        candidateId: body.candidateId,
        roomId: body.roomId,
        bedNumber: body.bedNumber,
        startDate: this.parseDate(body.startDate),
      },
      include: { room: { include: { hostel: true } }, candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  // ─── Inventory ─────────────────────────────────────────────────

  async listInventory(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createInventoryItem(tenantId: string, body: { name: string; sku: string; category?: string; quantity?: number; unit?: string; reorderLevel?: number; unitCost?: number }) {
    return this.prisma.inventoryItem.create({
      data: {
        tenantId,
        name: body.name,
        sku: body.sku,
        category: body.category,
        quantity: body.quantity ?? 0,
        unit: body.unit ?? 'pcs',
        reorderLevel: body.reorderLevel ?? 5,
        unitCost: this.decimal(body.unitCost ?? 0),
      },
    });
  }

  async recordInventoryTransaction(body: { itemId: string; type: string; quantity: number; reference?: string; remarks?: string }) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: body.itemId } });
    if (!item) throw new NotFoundException('Item not found');
    const delta = body.type === 'ISSUE' ? -body.quantity : body.quantity;
    await this.prisma.inventoryItem.update({ where: { id: body.itemId }, data: { quantity: { increment: delta } } });
    return this.prisma.inventoryTransaction.create({
      data: { itemId: body.itemId, type: body.type as never, quantity: body.quantity, reference: body.reference, remarks: body.remarks },
    });
  }

  // ─── Notifications & Discipline ────────────────────────────────

  async listNotifications(tenantId: string) {
    return this.prisma.notificationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async sendNotification(tenantId: string, body: { channel?: string; recipient: string; subject?: string; body: string }) {
    return this.prisma.notificationLog.create({
      data: {
        tenantId,
        channel: (body.channel as NotificationChannel) ?? 'IN_APP',
        recipient: body.recipient,
        subject: body.subject,
        body: body.body,
        status: 'SENT' as NotificationStatus,
        sentAt: new Date(),
      },
    });
  }

  async listDisciplineRecords(tenantId: string, candidateId?: string) {
    return this.prisma.disciplineRecord.findMany({
      where: { tenantId, ...(candidateId ? { candidateId } : {}) },
      include: { candidate: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async createDisciplineRecord(tenantId: string, userId: string, body: { candidateId: string; incidentDate: string; category: string; description: string; severity?: string; actionTaken?: string }) {
    return this.prisma.disciplineRecord.create({
      data: {
        tenantId,
        candidateId: body.candidateId,
        incidentDate: this.parseDate(body.incidentDate),
        category: body.category,
        description: body.description,
        severity: (body.severity as never) ?? 'LOW',
        actionTaken: body.actionTaken,
        recordedById: userId,
      },
    });
  }

  // ─── ERP Dashboard Summary ─────────────────────────────────────

  async getErpDashboard(tenantId: string) {
    const [
      enquiryCount,
      pendingApplications,
      feeSummary,
      staffCount,
      bookCount,
      routeCount,
      hostelCount,
      lowStock,
    ] = await Promise.all([
      this.prisma.admissionEnquiry.count({ where: { tenantId, status: 'NEW' } }),
      this.prisma.admissionApplication.count({ where: { tenantId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      this.getFeeSummary(tenantId),
      this.prisma.staffProfile.count({ where: { tenantId } }),
      this.prisma.libraryBook.count({ where: { tenantId } }),
      this.prisma.transportRoute.count({ where: { tenantId, isActive: true } }),
      this.prisma.hostel.count({ where: { tenantId, isActive: true } }),
      this.prisma.inventoryItem.count({ where: { tenantId, quantity: { lte: 5 } } }),
    ]);

    return {
      admissions: { newEnquiries: enquiryCount, pendingApplications },
      fees: feeSummary,
      staff: staffCount,
      library: { totalBooks: bookCount },
      transport: { activeRoutes: routeCount },
      hostel: { totalHostels: hostelCount },
      inventory: { lowStockItems: lowStock },
    };
  }
}
