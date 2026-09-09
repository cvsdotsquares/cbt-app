import { PrismaClient } from '@prisma/client';

type ErpSeedContext = {
  tenantId: string;
  adminId: string;
  candidateId: string;
  teacherUserId: string;
  batchId?: string;
  subjectId?: string;
};

export async function seedSchoolErpDemo(prisma: PrismaClient, ctx: ErpSeedContext) {
  console.log('Seeding School ERP demo data...');

  const yearStart = new Date('2025-04-01T00:00:00.000Z');
  const yearEnd = new Date('2026-03-31T00:00:00.000Z');

  const academicYear = await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId: ctx.tenantId, name: '2025-26' } },
    update: { isCurrent: true, status: 'ACTIVE' },
    create: {
      tenantId: ctx.tenantId,
      name: '2025-26',
      startDate: yearStart,
      endDate: yearEnd,
      isCurrent: true,
      status: 'ACTIVE',
    },
  });

  await prisma.calendarEvent.deleteMany({
    where: { tenantId: ctx.tenantId, title: { in: ['Diwali Break', 'Annual Day', 'Term 1 Exams', 'Republic Day'] } },
  });
  await prisma.calendarEvent.createMany({
    data: [
      { tenantId: ctx.tenantId, academicYearId: academicYear.id, title: 'Diwali Break', eventType: 'HOLIDAY', startDate: new Date('2025-10-20T00:00:00.000Z'), endDate: new Date('2025-10-25T00:00:00.000Z'), isHoliday: true },
      { tenantId: ctx.tenantId, academicYearId: academicYear.id, title: 'Republic Day', eventType: 'HOLIDAY', startDate: new Date('2026-01-26T00:00:00.000Z'), isHoliday: true },
      { tenantId: ctx.tenantId, academicYearId: academicYear.id, title: 'Term 1 Exams', eventType: 'EXAM', startDate: new Date('2025-09-15T00:00:00.000Z'), endDate: new Date('2025-09-25T00:00:00.000Z'), isHoliday: false },
      { tenantId: ctx.tenantId, academicYearId: academicYear.id, title: 'Annual Day', eventType: 'EVENT', startDate: new Date('2025-12-10T00:00:00.000Z'), isHoliday: false, description: 'Cultural programme and prize distribution' },
    ],
  });

  const enquiry = await prisma.admissionEnquiry.upsert({
    where: { id: '00000000-0000-4000-8000-000000000e01' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000e01',
      tenantId: ctx.tenantId,
      studentName: 'Aarav Sharma',
      parentName: 'Rajesh Sharma',
      phone: '9876543210',
      email: 'rajesh.sharma@example.com',
      classApplied: 'Class 10',
      source: 'Website',
      status: 'NEW',
      notes: 'Interested in science stream',
    },
  });

  await prisma.admissionEnquiry.upsert({
    where: { id: '00000000-0000-4000-8000-000000000e02' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000e02',
      tenantId: ctx.tenantId,
      studentName: 'Priya Nair',
      parentName: 'Suresh Nair',
      phone: '9123456780',
      classApplied: 'Class 9',
      source: 'Referral',
      status: 'CONTACTED',
      handledById: ctx.adminId,
    },
  });

  await prisma.admissionApplication.upsert({
    where: { tenantId_applicationNo: { tenantId: ctx.tenantId, applicationNo: 'APP-DEMO-001' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      enquiryId: enquiry.id,
      applicationNo: 'APP-DEMO-001',
      studentName: 'Aarav Sharma',
      parentName: 'Rajesh Sharma',
      parentPhone: '9876543210',
      parentEmail: 'rajesh.sharma@example.com',
      classApplied: 'Class 10',
      previousSchool: 'Delhi Public School',
      academicYearId: academicYear.id,
      status: 'UNDER_REVIEW',
    },
  });

  await prisma.admissionApplication.upsert({
    where: { tenantId_applicationNo: { tenantId: ctx.tenantId, applicationNo: 'APP-DEMO-002' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      applicationNo: 'APP-DEMO-002',
      studentName: 'Isha Patel',
      parentName: 'Meena Patel',
      parentPhone: '9988776655',
      classApplied: 'Class 11',
      academicYearId: academicYear.id,
      status: 'INTERVIEW_SCHEDULED',
      interviewDate: new Date('2025-10-05T10:00:00.000Z'),
    },
  });

  const tuitionHead = await prisma.feeHead.upsert({
    where: { tenantId_code: { tenantId: ctx.tenantId, code: 'TUITION' } },
    update: {},
    create: { tenantId: ctx.tenantId, name: 'Tuition Fee', code: 'TUITION', description: 'Quarterly tuition' },
  });
  const transportHead = await prisma.feeHead.upsert({
    where: { tenantId_code: { tenantId: ctx.tenantId, code: 'TRANSPORT' } },
    update: {},
    create: { tenantId: ctx.tenantId, name: 'Transport Fee', code: 'TRANSPORT' },
  });

  const feeStructure = await prisma.feeStructure.upsert({
    where: { id: '00000000-0000-4000-8000-000000000f01' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000f01',
      tenantId: ctx.tenantId,
      name: 'Class 10 — Term 1',
      academicYearId: academicYear.id,
      batchId: ctx.batchId,
      totalAmount: 25000,
    },
  });

  await prisma.feeStructureLine.upsert({
    where: { feeStructureId_feeHeadId: { feeStructureId: feeStructure.id, feeHeadId: tuitionHead.id } },
    update: { amount: 20000 },
    create: { feeStructureId: feeStructure.id, feeHeadId: tuitionHead.id, amount: 20000, dueDate: new Date('2025-07-15T00:00:00.000Z') },
  });
  await prisma.feeStructureLine.upsert({
    where: { feeStructureId_feeHeadId: { feeStructureId: feeStructure.id, feeHeadId: transportHead.id } },
    update: { amount: 5000 },
    create: { feeStructureId: feeStructure.id, feeHeadId: transportHead.id, amount: 5000 },
  });

  const invoice = await prisma.feeInvoice.upsert({
    where: { tenantId_invoiceNo: { tenantId: ctx.tenantId, invoiceNo: 'INV-DEMO-001' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      invoiceNo: 'INV-DEMO-001',
      candidateId: ctx.candidateId,
      feeStructureId: feeStructure.id,
      totalAmount: 25000,
      paidAmount: 15000,
      discountAmount: 0,
      dueDate: new Date('2025-08-31T00:00:00.000Z'),
      status: 'PARTIALLY_PAID',
    },
  });

  await prisma.feeInvoice.upsert({
    where: { tenantId_invoiceNo: { tenantId: ctx.tenantId, invoiceNo: 'INV-DEMO-002' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      invoiceNo: 'INV-DEMO-002',
      candidateId: ctx.candidateId,
      totalAmount: 3500,
      paidAmount: 0,
      dueDate: new Date('2025-09-30T00:00:00.000Z'),
      status: 'ISSUED',
      remarks: 'Lab fee — Class 10',
    },
  });

  const existingPayment = await prisma.feePayment.findFirst({ where: { invoiceId: invoice.id, receiptNo: 'RCP-DEMO-001' } });
  if (!existingPayment) {
    await prisma.feePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: 15000,
        method: 'UPI',
        referenceNo: 'UPI123456789',
        receiptNo: 'RCP-DEMO-001',
        recordedById: ctx.adminId,
        remarks: 'Partial payment — Term 1',
      },
    });
  }

  const term = await prisma.academicTerm.upsert({
    where: { academicYearId_termNumber: { academicYearId: academicYear.id, termNumber: 1 } },
    update: { isCurrent: true },
    create: {
      tenantId: ctx.tenantId,
      academicYearId: academicYear.id,
      name: 'Term 1 (Apr–Sep)',
      termNumber: 1,
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2025-09-30T00:00:00.000Z'),
      isCurrent: true,
    },
  });

  if (ctx.subjectId) {
    await prisma.gradeEntry.upsert({
      where: { termId_candidateId_subjectId: { termId: term.id, candidateId: ctx.candidateId, subjectId: ctx.subjectId } },
      update: { marksObtained: 82, grade: 'A' },
      create: {
        tenantId: ctx.tenantId,
        termId: term.id,
        candidateId: ctx.candidateId,
        subjectId: ctx.subjectId,
        maxMarks: 100,
        marksObtained: 82,
        grade: 'A',
        enteredById: ctx.teacherUserId,
      },
    });
  }

  await prisma.reportCard.upsert({
    where: { termId_candidateId: { termId: term.id, candidateId: ctx.candidateId } },
    update: { overallGrade: 'A', percentage: 82, status: 'PUBLISHED' },
    create: {
      tenantId: ctx.tenantId,
      termId: term.id,
      candidateId: ctx.candidateId,
      totalMarks: 82,
      maxMarks: 100,
      percentage: 82,
      overallGrade: 'A',
      attendancePct: 92,
      rank: 5,
      status: 'PUBLISHED',
      issuedById: ctx.adminId,
      issuedAt: new Date(),
      remarks: 'Good progress in science.',
    },
  });

  const route = await prisma.transportRoute.upsert({
    where: { tenantId_code: { tenantId: ctx.tenantId, code: 'R-01' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      name: 'Route 1 — City Centre',
      code: 'R-01',
      startPoint: 'School Gate',
      endPoint: 'Central Market',
      monthlyFee: 1200,
    },
  });

  await prisma.transportStop.deleteMany({ where: { routeId: route.id } });
  await prisma.transportStop.createMany({
    data: [
      { routeId: route.id, name: 'School Gate', sequence: 1, pickUpTime: '07:30' },
      { routeId: route.id, name: 'Green Park', sequence: 2, pickUpTime: '07:45' },
      { routeId: route.id, name: 'Central Market', sequence: 3, pickUpTime: '08:00' },
    ],
  });

  await prisma.transportVehicle.upsert({
    where: { tenantId_registration: { tenantId: ctx.tenantId, registration: 'DL-01-AB-1234' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      routeId: route.id,
      registration: 'DL-01-AB-1234',
      capacity: 40,
      driverName: 'Ramesh Kumar',
      driverPhone: '9811122233',
    },
  });

  await prisma.transportAssignment.upsert({
    where: { candidateId: ctx.candidateId },
    update: { routeId: route.id },
    create: {
      candidateId: ctx.candidateId,
      routeId: route.id,
      startDate: new Date('2025-04-01T00:00:00.000Z'),
    },
  });

  await prisma.libraryBook.upsert({
    where: { id: '00000000-0000-4000-8000-000000000b01' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000b01',
      tenantId: ctx.tenantId,
      title: 'NCERT Science — Class 10',
      author: 'NCERT',
      isbn: '978-81-7450-494-4',
      category: 'Textbook',
      totalCopies: 25,
      available: 22,
      shelfLocation: 'A-12',
    },
  });
  await prisma.libraryBook.upsert({
    where: { id: '00000000-0000-4000-8000-000000000b02' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000b02',
      tenantId: ctx.tenantId,
      title: 'Mathematics for Class 10',
      author: 'R.D. Sharma',
      category: 'Reference',
      totalCopies: 10,
      available: 8,
      shelfLocation: 'B-04',
    },
  });

  const issuedBook = await prisma.libraryBook.findUnique({ where: { id: '00000000-0000-4000-8000-000000000b01' } });
  if (issuedBook) {
    const existingIssue = await prisma.libraryIssue.findFirst({
      where: { bookId: issuedBook.id, candidateId: ctx.candidateId, status: 'ISSUED' },
    });
    if (!existingIssue) {
      await prisma.libraryBook.update({ where: { id: issuedBook.id }, data: { available: { decrement: 1 } } });
      await prisma.libraryIssue.create({
        data: {
          bookId: issuedBook.id,
          candidateId: ctx.candidateId,
          dueDate: new Date('2025-10-15T00:00:00.000Z'),
          status: 'ISSUED',
          issuedById: ctx.adminId,
        },
      });
    }
  }

  await prisma.staffProfile.upsert({
    where: { tenantId_employeeId: { tenantId: ctx.tenantId, employeeId: 'EMP-T001' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.teacherUserId,
      employeeId: 'EMP-T001',
      department: 'Science',
      designation: 'Senior Teacher',
      joiningDate: new Date('2020-06-01T00:00:00.000Z'),
      basicSalary: 45000,
    },
  });

  const staff = await prisma.staffProfile.findUnique({
    where: { tenantId_employeeId: { tenantId: ctx.tenantId, employeeId: 'EMP-T001' } },
  });
  if (staff) {
    const leaveExists = await prisma.leaveApplication.findFirst({ where: { staffId: staff.id, reason: 'Family function' } });
    if (!leaveExists) {
      await prisma.leaveApplication.create({
        data: {
          staffId: staff.id,
          leaveType: 'CASUAL',
          startDate: new Date('2025-10-02T00:00:00.000Z'),
          endDate: new Date('2025-10-03T00:00:00.000Z'),
          reason: 'Family function',
          applicantId: ctx.teacherUserId,
          status: 'PENDING',
        },
      });
    }
    await prisma.salarySlip.upsert({
      where: { staffId_month_year: { staffId: staff.id, month: 8, year: 2025 } },
      update: {},
      create: {
        staffId: staff.id,
        userId: ctx.teacherUserId,
        month: 8,
        year: 2025,
        basicSalary: 45000,
        allowances: 5000,
        deductions: 2000,
        netSalary: 48000,
        paidAt: new Date('2025-09-01T00:00:00.000Z'),
      },
    });
  }

  const hostel = await prisma.hostel.upsert({
    where: { tenantId_name: { tenantId: ctx.tenantId, name: 'Boys Hostel — Block A' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      name: 'Boys Hostel — Block A',
      address: 'Campus North Wing',
      wardenName: 'Mr. Verma',
      wardenPhone: '9876500001',
    },
  });

  const room = await prisma.hostelRoom.upsert({
    where: { hostelId_roomNumber: { hostelId: hostel.id, roomNumber: 'A-101' } },
    update: {},
    create: {
      hostelId: hostel.id,
      roomNumber: 'A-101',
      roomType: 'DOUBLE',
      capacity: 2,
      occupied: 1,
      monthlyFee: 8000,
    },
  });

  const hostelAlloc = await prisma.hostelAllocation.findUnique({ where: { candidateId: ctx.candidateId } });
  if (!hostelAlloc) {
    await prisma.hostelAllocation.create({
      data: {
        candidateId: ctx.candidateId,
        roomId: room.id,
        bedNumber: 'B1',
        startDate: new Date('2025-04-01T00:00:00.000Z'),
      },
    });
  }

  await prisma.inventoryItem.upsert({
    where: { tenantId_sku: { tenantId: ctx.tenantId, sku: 'UNI-10-M' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      name: 'School Uniform — Size M',
      sku: 'UNI-10-M',
      category: 'Uniform',
      quantity: 45,
      reorderLevel: 10,
      unitCost: 850,
    },
  });
  await prisma.inventoryItem.upsert({
    where: { tenantId_sku: { tenantId: ctx.tenantId, sku: 'LAB-GOGGLES' } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      name: 'Lab Safety Goggles',
      sku: 'LAB-GOGGLES',
      category: 'Lab Equipment',
      quantity: 3,
      reorderLevel: 5,
      unitCost: 120,
    },
  });

  const notifCount = await prisma.notificationLog.count({ where: { tenantId: ctx.tenantId } });
  if (notifCount < 2) {
    await prisma.notificationLog.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          channel: 'EMAIL',
          recipient: 'parent@example.com',
          subject: 'Fee reminder — Term 1',
          body: 'Dear parent, please clear the outstanding fee balance by 31 Aug 2025.',
          status: 'SENT',
          sentAt: new Date(),
        },
        {
          tenantId: ctx.tenantId,
          channel: 'IN_APP',
          recipient: 'candidate@example.com',
          subject: 'Library book due',
          body: 'Your book "NCERT Science — Class 10" is due on 15 Oct 2025.',
          status: 'SENT',
          sentAt: new Date(),
        },
      ],
    });
  }

  const disciplineExists = await prisma.disciplineRecord.findFirst({
    where: { tenantId: ctx.tenantId, candidateId: ctx.candidateId, category: 'Late arrival' },
  });
  if (!disciplineExists) {
    await prisma.disciplineRecord.create({
      data: {
        tenantId: ctx.tenantId,
        candidateId: ctx.candidateId,
        incidentDate: new Date('2025-08-12T00:00:00.000Z'),
        category: 'Late arrival',
        description: 'Arrived 15 minutes late to morning assembly.',
        severity: 'LOW',
        actionTaken: 'Verbal warning',
        recordedById: ctx.adminId,
      },
    });
  }

  await prisma.gradingBoardConfig.upsert({
    where: { tenantId_name: { tenantId: ctx.tenantId, name: 'CBSE Default' } },
    update: { isDefault: true },
    create: {
      tenantId: ctx.tenantId,
      name: 'CBSE Default',
      boardType: 'CBSE',
      isDefault: true,
      gradeRules: {
        'A+': { min: 91, max: 100 },
        A: { min: 81, max: 90 },
        'B+': { min: 71, max: 80 },
        B: { min: 61, max: 70 },
        C: { min: 51, max: 60 },
        D: { min: 41, max: 50 },
        E: { min: 33, max: 40 },
        F: { min: 0, max: 32 },
      },
    },
  });

  if (ctx.batchId && ctx.subjectId) {
    const now = new Date();
    const liveStart = new Date(now.getTime() - 30 * 60 * 1000);
    const liveEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const schedStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const schedEnd = new Date(schedStart.getTime() + 45 * 60 * 1000);
    const stamp = liveStart.toISOString().slice(0, 10).replace(/-/g, '');
    const meetingUrl = `https://meet.jit.si/cbt-demo-batch-a-sci-${stamp}`;

    await prisma.liveClass.upsert({
      where: { id: '00000000-0000-4000-8000-000000000l01' },
      update: {
        startTime: liveStart,
        endTime: liveEnd,
        status: 'LIVE',
        meetingUrl,
      },
      create: {
        id: '00000000-0000-4000-8000-000000000l01',
        tenantId: ctx.tenantId,
        batchId: ctx.batchId,
        subjectId: ctx.subjectId,
        teacherId: ctx.teacherUserId,
        title: 'Science — Live doubt session',
        description: 'NCERT Class 10 Science revision and Q&A with your teacher.',
        startTime: liveStart,
        endTime: liveEnd,
        provider: 'JITSI',
        meetingUrl,
        status: 'LIVE',
        createdById: ctx.teacherUserId,
      },
    });

    await prisma.liveClass.upsert({
      where: { id: '00000000-0000-4000-8000-000000000l02' },
      update: {
        startTime: schedStart,
        endTime: schedEnd,
        status: 'SCHEDULED',
      },
      create: {
        id: '00000000-0000-4000-8000-000000000l02',
        tenantId: ctx.tenantId,
        batchId: ctx.batchId,
        subjectId: ctx.subjectId,
        teacherId: ctx.teacherUserId,
        title: 'Science — Weekly revision',
        description: 'Scheduled online class for Batch A.',
        startTime: schedStart,
        endTime: schedEnd,
        provider: 'JITSI',
        meetingUrl: `https://meet.jit.si/cbt-demo-batch-a-sci-next`,
        status: 'SCHEDULED',
        createdById: ctx.teacherUserId,
      },
    });
  }

  console.log('School ERP demo data seeded.');
}
