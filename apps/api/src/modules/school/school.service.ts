import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  DayOfWeek,
  HomeworkSubmissionStatus,
  NoticeTarget,
  Prisma,
} from '@prisma/client';
import { LiveClassProvider, LiveClassStatus } from '@cbt/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getTeacherBatchIds,
  teacherHasBatchAccess,
} from '../../common/utils/teacher-scope.util';

const DEFAULT_PERIODS = [
  { periodNumber: 1, label: 'Period 1', startTime: '08:00', endTime: '08:45' },
  { periodNumber: 2, label: 'Period 2', startTime: '08:45', endTime: '09:30' },
  { periodNumber: 3, label: 'Period 3', startTime: '09:45', endTime: '10:30' },
  { periodNumber: 4, label: 'Period 4', startTime: '10:30', endTime: '11:15' },
  { periodNumber: 5, label: 'Period 5', startTime: '11:30', endTime: '12:15' },
  { periodNumber: 6, label: 'Period 6', startTime: '12:15', endTime: '13:00' },
  { periodNumber: 7, label: 'Period 7', startTime: '14:00', endTime: '14:45' },
  { periodNumber: 8, label: 'Period 8', startTime: '14:45', endTime: '15:30' },
];

const WEEKDAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

@Injectable()
export class SchoolService {
  constructor(private prisma: PrismaService) {}

  private parseDateOnly(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return date;
  }

  private async assertBatchAccess(tenantId: string, batchId: string, teacherUserId?: string) {
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, tenantId } });
    if (!batch) throw new NotFoundException('Class batch not found');
    if (teacherUserId) {
      const allowed = await teacherHasBatchAccess(this.prisma, teacherUserId, batchId);
      if (!allowed) throw new ForbiddenException('You are not assigned to this class');
    }
    return batch;
  }

  private async getCandidateForUser(userId: string, tenantId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { userId, tenantId },
      include: {
        batchEnrollments: {
          include: {
            batch: {
              include: { academicClass: true },
            },
          },
        },
      },
    });
    if (!candidate) throw new NotFoundException('Student profile not found');
    return candidate;
  }

  // ─── Period config & timetable ───────────────────────────────

  async getPeriodConfig(tenantId: string) {
    let periods = await this.prisma.periodConfig.findMany({
      where: { tenantId },
      orderBy: { periodNumber: 'asc' },
    });
    if (periods.length === 0) {
      await this.prisma.periodConfig.createMany({
        data: DEFAULT_PERIODS.map((p) => ({ ...p, tenantId })),
      });
      periods = await this.prisma.periodConfig.findMany({
        where: { tenantId },
        orderBy: { periodNumber: 'asc' },
      });
    }
    return periods;
  }

  async updatePeriodConfig(
    tenantId: string,
    periods: { periodNumber: number; label: string; startTime: string; endTime: string }[],
  ) {
    await this.prisma.$transaction(
      periods.map((p) =>
        this.prisma.periodConfig.upsert({
          where: { tenantId_periodNumber: { tenantId, periodNumber: p.periodNumber } },
          update: { label: p.label, startTime: p.startTime, endTime: p.endTime },
          create: { tenantId, ...p },
        }),
      ),
    );
    return this.getPeriodConfig(tenantId);
  }

  async getTimetable(tenantId: string, batchId: string, teacherUserId?: string) {
    await this.assertBatchAccess(tenantId, batchId, teacherUserId);
    const [periods, slots] = await Promise.all([
      this.getPeriodConfig(tenantId),
      this.prisma.timetableSlot.findMany({
        where: { tenantId, batchId },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
      }),
    ]);
    return { periods, slots, days: WEEKDAYS };
  }

  async upsertTimetableSlot(
    tenantId: string,
    data: {
      batchId: string;
      subjectId: string;
      teacherId?: string;
      dayOfWeek: DayOfWeek;
      periodNumber: number;
      room?: string;
    },
    teacherUserId?: string,
  ) {
    await this.assertBatchAccess(tenantId, data.batchId, teacherUserId);
    return this.prisma.timetableSlot.upsert({
      where: {
        batchId_dayOfWeek_periodNumber: {
          batchId: data.batchId,
          dayOfWeek: data.dayOfWeek,
          periodNumber: data.periodNumber,
        },
      },
      update: {
        subjectId: data.subjectId,
        teacherId: data.teacherId ?? null,
        room: data.room ?? null,
      },
      create: { tenantId, ...data },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deleteTimetableSlot(tenantId: string, slotId: string, teacherUserId?: string) {
    const slot = await this.prisma.timetableSlot.findFirst({ where: { id: slotId, tenantId } });
    if (!slot) throw new NotFoundException('Timetable slot not found');
    if (teacherUserId) {
      await this.assertBatchAccess(tenantId, slot.batchId, teacherUserId);
    }
    await this.prisma.timetableSlot.delete({ where: { id: slotId } });
    return { deleted: true };
  }

  // ─── Attendance ──────────────────────────────────────────────

  async getAttendanceSheet(
    tenantId: string,
    batchId: string,
    dateStr: string,
    teacherUserId?: string,
  ) {
    await this.assertBatchAccess(tenantId, batchId, teacherUserId);
    const date = this.parseDateOnly(dateStr);

    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        academicClass: { select: { id: true, name: true, level: true } },
        enrollments: {
          include: {
            candidate: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
          orderBy: { rollNumber: 'asc' },
        },
      },
    });
    if (!batch) throw new NotFoundException('Class batch not found');

    const records = await this.prisma.attendanceRecord.findMany({
      where: { batchId, date },
    });
    const recordMap = new Map(records.map((r) => [r.candidateId, r]));

    const students = batch.enrollments.map((e) => {
      const record = recordMap.get(e.candidateId);
      return {
        candidateId: e.candidateId,
        rollNumber: e.rollNumber,
        name: `${e.candidate.user.firstName} ${e.candidate.user.lastName}`.trim(),
        email: e.candidate.user.email,
        status: record?.status ?? AttendanceStatus.ABSENT,
        recordId: record?.id ?? null,
        remarks: record?.remarks ?? null,
      };
    });

    const present = students.filter((s) => s.status === AttendanceStatus.PRESENT).length;
    const absent = students.filter((s) => s.status === AttendanceStatus.ABSENT).length;

    return {
      batch: {
        id: batch.id,
        name: batch.name,
        academicYear: batch.academicYear,
        academicClass: batch.academicClass,
      },
      date: dateStr,
      summary: { total: students.length, present, absent },
      students,
    };
  }

  async markAttendance(
    tenantId: string,
    batchId: string,
    dateStr: string,
    entries: { candidateId: string; status: AttendanceStatus; remarks?: string }[],
    markedById: string,
    teacherUserId?: string,
  ) {
    await this.assertBatchAccess(tenantId, batchId, teacherUserId);
    const date = this.parseDateOnly(dateStr);

    await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            batchId_candidateId_date: {
              batchId,
              candidateId: entry.candidateId,
              date,
            },
          },
          update: {
            status: entry.status,
            remarks: entry.remarks ?? null,
            markedById,
          },
          create: {
            tenantId,
            batchId,
            candidateId: entry.candidateId,
            date,
            status: entry.status,
            remarks: entry.remarks ?? null,
            markedById,
          },
        }),
      ),
    );

    return this.getAttendanceSheet(tenantId, batchId, dateStr, teacherUserId);
  }

  async getAttendanceReport(
    tenantId: string,
    batchId: string,
    fromStr: string,
    toStr: string,
    teacherUserId?: string,
  ) {
    await this.assertBatchAccess(tenantId, batchId, teacherUserId);
    const from = this.parseDateOnly(fromStr);
    const to = this.parseDateOnly(toStr);

    const enrollments = await this.prisma.batchEnrollment.findMany({
      where: { batchId },
      include: {
        candidate: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: { batchId, date: { gte: from, lte: to } },
    });

    const byCandidate = new Map<string, typeof records>();
    for (const r of records) {
      const list = byCandidate.get(r.candidateId) ?? [];
      list.push(r);
      byCandidate.set(r.candidateId, list);
    }

    return enrollments.map((e) => {
      const studentRecords = byCandidate.get(e.candidateId) ?? [];
      const totalDays = studentRecords.length;
      const present = studentRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
      const absent = studentRecords.filter((r) => r.status === AttendanceStatus.ABSENT).length;
      const late = studentRecords.filter((r) => r.status === AttendanceStatus.LATE).length;
      const leave = studentRecords.filter((r) => r.status === AttendanceStatus.LEAVE).length;
      const percentage = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

      return {
        candidateId: e.candidateId,
        rollNumber: e.rollNumber,
        name: `${e.candidate.user.firstName} ${e.candidate.user.lastName}`.trim(),
        totalDays,
        present,
        absent,
        late,
        leave,
        percentage,
      };
    });
  }

  // ─── Homework ────────────────────────────────────────────────

  async listHomework(
    tenantId: string,
    filters: { batchId?: string; subjectId?: string },
    teacherUserId?: string,
  ) {
    const where: Prisma.HomeworkWhereInput = { tenantId };
    if (filters.batchId) where.batchId = filters.batchId;
    if (filters.subjectId) where.subjectId = filters.subjectId;

    if (teacherUserId) {
      const batchIds = await getTeacherBatchIds(this.prisma, teacherUserId);
      if (batchIds.length === 0) return [];
      where.batchId = filters.batchId
        ? batchIds.includes(filters.batchId)
          ? filters.batchId
          : '__none__'
        : { in: batchIds };
    }

    return this.prisma.homework.findMany({
      where,
      orderBy: { dueDate: 'desc' },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        batch: {
          select: {
            id: true,
            name: true,
            academicYear: true,
            academicClass: { select: { id: true, name: true, level: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
    });
  }

  async createHomework(
    tenantId: string,
    userId: string,
    data: {
      batchId: string;
      subjectId: string;
      title: string;
      description?: string;
      dueDate: string;
    },
    teacherUserId?: string,
  ) {
    await this.assertBatchAccess(tenantId, data.batchId, teacherUserId);
    return this.prisma.homework.create({
      data: {
        tenantId,
        batchId: data.batchId,
        subjectId: data.subjectId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        dueDate: new Date(data.dueDate),
        createdById: userId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
      },
    });
  }

  async getHomeworkDetail(tenantId: string, homeworkId: string, teacherUserId?: string) {
    const homework = await this.prisma.homework.findFirst({
      where: { id: homeworkId, tenantId },
      include: {
        subject: true,
        batch: { include: { enrollments: { include: { candidate: { include: { user: true } } } } } },
        submissions: {
          include: {
            candidate: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          },
        },
      },
    });
    if (!homework) throw new NotFoundException('Homework not found');
    if (teacherUserId) {
      await this.assertBatchAccess(tenantId, homework.batchId, teacherUserId);
    }
    return homework;
  }

  async submitHomework(
    tenantId: string,
    userId: string,
    homeworkId: string,
    content: string,
  ) {
    const candidate = await this.getCandidateForUser(userId, tenantId);
    const homework = await this.prisma.homework.findFirst({
      where: { id: homeworkId, tenantId },
    });
    if (!homework) throw new NotFoundException('Homework not found');

    const enrolled = await this.prisma.batchEnrollment.findFirst({
      where: { batchId: homework.batchId, candidateId: candidate.id },
    });
    if (!enrolled) throw new ForbiddenException('You are not enrolled in this class');

    const now = new Date();
    const isLate = now > homework.dueDate;
    const status = isLate ? HomeworkSubmissionStatus.LATE : HomeworkSubmissionStatus.SUBMITTED;

    return this.prisma.homeworkSubmission.upsert({
      where: { homeworkId_candidateId: { homeworkId, candidateId: candidate.id } },
      update: { content, status, submittedAt: now },
      create: {
        homeworkId,
        candidateId: candidate.id,
        content,
        status,
        submittedAt: now,
      },
    });
  }

  async gradeHomeworkSubmission(
    tenantId: string,
    submissionId: string,
    grade: string,
    feedback?: string,
    teacherUserId?: string,
  ) {
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: { id: submissionId },
      include: { homework: true },
    });
    if (!submission || submission.homework.tenantId !== tenantId) {
      throw new NotFoundException('Submission not found');
    }
    if (teacherUserId) {
      await this.assertBatchAccess(tenantId, submission.homework.batchId, teacherUserId);
    }
    return this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: { grade, feedback: feedback ?? null, status: HomeworkSubmissionStatus.GRADED },
    });
  }

  async getStudentHomework(tenantId: string, userId: string) {
    const candidate = await this.getCandidateForUser(userId, tenantId);
    const batchIds = candidate.batchEnrollments.map((e) => e.batchId);
    if (batchIds.length === 0) return [];

    const homeworks = await this.prisma.homework.findMany({
      where: { tenantId, batchId: { in: batchIds } },
      orderBy: { dueDate: 'desc' },
      include: {
        subject: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
        submissions: { where: { candidateId: candidate.id } },
      },
    });

    return homeworks.map((hw) => ({
      ...hw,
      mySubmission: hw.submissions[0] ?? null,
      submissions: undefined,
    }));
  }

  // ─── Notices ─────────────────────────────────────────────────

  async listNotices(tenantId: string, batchIds?: string[], academicClassIds?: string[]) {
    const now = new Date();
    const notices = await this.prisma.notice.findMany({
      where: {
        tenantId,
        isPublished: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return notices.filter((n) => {
      if (n.targetType === NoticeTarget.ALL) return true;
      if (n.targetType === NoticeTarget.BATCH && n.targetId && batchIds?.includes(n.targetId)) {
        return true;
      }
      if (
        n.targetType === NoticeTarget.ACADEMIC_CLASS
        && n.targetId
        && academicClassIds?.includes(n.targetId)
      ) {
        return true;
      }
      return !batchIds && !academicClassIds;
    });
  }

  async createNotice(
    tenantId: string,
    userId: string,
    data: {
      title: string;
      body: string;
      targetType?: NoticeTarget;
      targetId?: string;
      expiresAt?: string;
    },
  ) {
    return this.prisma.notice.create({
      data: {
        tenantId,
        title: data.title.trim(),
        body: data.body.trim(),
        targetType: data.targetType ?? NoticeTarget.ALL,
        targetId: data.targetId ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdById: userId,
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async deleteNotice(tenantId: string, noticeId: string) {
    const notice = await this.prisma.notice.findFirst({ where: { id: noticeId, tenantId } });
    if (!notice) throw new NotFoundException('Notice not found');
    await this.prisma.notice.delete({ where: { id: noticeId } });
    return { deleted: true };
  }

  // ─── Live classes (VC) ───────────────────────────────────────

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  private buildJitsiUrl(tenantSlug: string, batchName: string, subjectCode: string, startTime: Date): string {
    const stamp = startTime.toISOString().slice(0, 10).replace(/-/g, '');
    const room = `${this.slugify(tenantSlug)}-${this.slugify(batchName)}-${this.slugify(subjectCode)}-${stamp}`;
    return `https://meet.jit.si/${room}`;
  }

  private liveClassInclude = {
    subject: { select: { id: true, name: true, code: true } },
    batch: {
      select: {
        id: true,
        name: true,
        academicYear: true,
        academicClass: { select: { id: true, name: true, level: true } },
      },
    },
    teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    _count: { select: { joins: true } },
  } as const;

  private mapLiveClassForPortal(c: {
    id: string;
    title: string;
    description?: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
    provider: string;
    meetingUrl: string;
    subject: { id: string; name: string; code?: string };
    teacher?: { firstName: string; lastName: string };
  }) {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      startTime: c.startTime.toISOString(),
      endTime: c.endTime.toISOString(),
      status: c.status,
      provider: c.provider,
      meetingUrl: c.meetingUrl,
      subject: { id: c.subject.id, name: c.subject.name, code: c.subject.code },
      teacherName: c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}`.trim() : undefined,
    };
  }

  async listLiveClasses(
    tenantId: string,
    filters: { batchId?: string; status?: LiveClassStatus },
    teacherUserId?: string,
  ) {
    const where: Prisma.LiveClassWhereInput = { tenantId };
    if (filters.batchId) where.batchId = filters.batchId;
    if (filters.status) where.status = filters.status;

    if (teacherUserId) {
      const batchIds = await getTeacherBatchIds(this.prisma, teacherUserId);
      if (batchIds.length === 0) return [];
      where.batchId = filters.batchId
        ? batchIds.includes(filters.batchId)
          ? filters.batchId
          : '__none__'
        : { in: batchIds };
    }

    return this.prisma.liveClass.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: this.liveClassInclude,
    });
  }

  async createLiveClass(
    tenantId: string,
    userId: string,
    data: {
      batchId: string;
      subjectId: string;
      teacherId: string;
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      provider?: LiveClassProvider;
      meetingUrl?: string;
    },
    teacherUserId?: string,
  ) {
    await this.assertBatchAccess(tenantId, data.batchId, teacherUserId);

    const [tenant, batch, subject] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
      this.prisma.batch.findFirst({ where: { id: data.batchId, tenantId }, select: { name: true } }),
      this.prisma.subject.findUnique({ where: { id: data.subjectId }, select: { code: true } }),
    ]);
    if (!tenant || !batch || !subject) throw new NotFoundException('Class or subject not found');

    const provider = data.provider ?? LiveClassProvider.JITSI;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    if (endTime <= startTime) throw new BadRequestException('End time must be after start time');

    let meetingUrl = data.meetingUrl?.trim() ?? '';
    if (!meetingUrl) {
      if (provider === LiveClassProvider.JITSI) {
        meetingUrl = this.buildJitsiUrl(tenant.slug, batch.name, subject.code, startTime);
      } else {
        throw new BadRequestException('Meeting URL is required for this provider');
      }
    }

    return this.prisma.liveClass.create({
      data: {
        tenantId,
        batchId: data.batchId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        startTime,
        endTime,
        provider,
        meetingUrl,
        createdById: userId,
      },
      include: this.liveClassInclude,
    });
  }

  async updateLiveClassStatus(
    tenantId: string,
    liveClassId: string,
    status: LiveClassStatus,
    teacherUserId?: string,
    recordingUrl?: string,
  ) {
    const liveClass = await this.prisma.liveClass.findFirst({ where: { id: liveClassId, tenantId } });
    if (!liveClass) throw new NotFoundException('Live class not found');
    if (teacherUserId) {
      await this.assertBatchAccess(tenantId, liveClass.batchId, teacherUserId);
    }

    return this.prisma.liveClass.update({
      where: { id: liveClassId },
      data: {
        status,
        ...(recordingUrl !== undefined ? { recordingUrl: recordingUrl || null } : {}),
      },
      include: this.liveClassInclude,
    });
  }

  async joinLiveClass(tenantId: string, userId: string, liveClassId: string) {
    const liveClass = await this.prisma.liveClass.findFirst({
      where: { id: liveClassId, tenantId },
      include: { batch: { include: { enrollments: true } } },
    });
    if (!liveClass) throw new NotFoundException('Live class not found');
    if (liveClass.status === LiveClassStatus.CANCELLED) {
      throw new BadRequestException('This class was cancelled');
    }

    const candidate = await this.prisma.candidate.findFirst({ where: { userId, tenantId } });
    if (candidate) {
      const enrolled = liveClass.batch.enrollments.some(
        (e: { candidateId: string }) => e.candidateId === candidate.id,
      );
      if (!enrolled) throw new ForbiddenException('You are not enrolled in this class');
    }

    await this.prisma.liveClassJoin.upsert({
      where: { liveClassId_userId: { liveClassId, userId } },
      update: { joinedAt: new Date(), leftAt: null },
      create: {
        liveClassId,
        userId,
        candidateId: candidate?.id ?? null,
      },
    });

    if (liveClass.status === LiveClassStatus.SCHEDULED) {
      const now = new Date();
      if (now >= liveClass.startTime) {
        await this.prisma.liveClass.update({
          where: { id: liveClassId },
          data: { status: LiveClassStatus.LIVE },
        });
      }
    }

    return {
      meetingUrl: liveClass.meetingUrl,
      provider: liveClass.provider,
      title: liveClass.title,
      status: liveClass.status,
    };
  }

  async getStudentLiveClasses(tenantId: string, userId: string) {
    const candidate = await this.getCandidateForUser(userId, tenantId);
    const batchIds = candidate.batchEnrollments.map((e) => e.batchId);
    if (batchIds.length === 0) return { upcoming: [], live: [] };

    const now = new Date();
    const classes = await this.prisma.liveClass.findMany({
      where: {
        tenantId,
        batchId: { in: batchIds },
        status: { in: [LiveClassStatus.SCHEDULED, LiveClassStatus.LIVE] },
        endTime: { gte: now },
      },
      orderBy: { startTime: 'asc' },
      include: this.liveClassInclude,
    });

    return {
      live: classes
        .filter((c) => c.status === LiveClassStatus.LIVE)
        .map((c) => this.mapLiveClassForPortal(c)),
      upcoming: classes
        .filter((c) => c.status === LiveClassStatus.SCHEDULED)
        .map((c) => this.mapLiveClassForPortal(c)),
    };
  }

  // ─── Parent portal ───────────────────────────────────────────

  async linkParent(parentUserId: string, candidateId: string, relation = 'Parent') {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Student not found');
    return this.prisma.parentStudentLink.upsert({
      where: { parentUserId_candidateId: { parentUserId, candidateId } },
      update: { relation },
      create: { parentUserId, candidateId, relation },
      include: {
        candidate: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            batchEnrollments: {
              include: {
                batch: { include: { academicClass: true } },
              },
            },
          },
        },
      },
    });
  }

  async getParentDashboard(parentUserId: string, tenantId: string) {
    const links = await this.prisma.parentStudentLink.findMany({
      where: { parentUserId },
      include: {
        candidate: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            batchEnrollments: {
              include: {
                batch: { include: { academicClass: true } },
              },
            },
            results: {
              where: { published: true },
              orderBy: { createdAt: 'desc' },
              take: 5,
              include: { exam: { select: { title: true, code: true } } },
            },
          },
        },
      },
    });

    const children = await Promise.all(
      links.map(async (link) => {
        const candidate = link.candidate;
        const batchIds = candidate.batchEnrollments.map((e) => e.batchId);
        const classIds = candidate.batchEnrollments.map((e) => e.batch.academicClass.id);
        const primaryBatch = candidate.batchEnrollments[0]?.batch;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const now = new Date();
        const calendarTo = new Date(now);
        calendarTo.setMonth(calendarTo.getMonth() + 2);

        const [
          attendanceRecords,
          homeworks,
          notices,
          reportCards,
          feeInvoices,
          libraryIssues,
          transportAssignment,
          calendarEvents,
          certificates,
          leaveApplications,
          liveClassRows,
          timetable,
        ] = await Promise.all([
          this.prisma.attendanceRecord.findMany({
            where: { candidateId: candidate.id, date: { gte: thirtyDaysAgo } },
            orderBy: { date: 'desc' },
          }),
          this.prisma.homework.findMany({
            where: { tenantId, batchId: { in: batchIds } },
            orderBy: { dueDate: 'desc' },
            take: 10,
            include: {
              subject: { select: { name: true } },
              submissions: { where: { candidateId: candidate.id } },
            },
          }),
          this.listNotices(tenantId, batchIds, classIds),
          this.prisma.reportCard.findMany({
            where: { tenantId, candidateId: candidate.id, status: 'PUBLISHED' },
            include: { term: { include: { academicYear: true } } },
            orderBy: { issuedAt: 'desc' },
            take: 5,
          }),
          this.prisma.feeInvoice.findMany({
            where: { tenantId, candidateId: candidate.id },
            orderBy: { dueDate: 'desc' },
            take: 10,
          }),
          this.prisma.libraryIssue.findMany({
            where: { candidateId: candidate.id, status: 'ISSUED' },
            include: { book: true },
            orderBy: { dueDate: 'asc' },
          }),
          this.prisma.transportAssignment.findUnique({
            where: { candidateId: candidate.id },
            include: { route: { include: { stops: { orderBy: { sequence: 'asc' } } } } },
          }),
          this.prisma.calendarEvent.findMany({
            where: { tenantId, startDate: { gte: now, lte: calendarTo } },
            orderBy: { startDate: 'asc' },
            take: 10,
          }),
          this.prisma.studentCertificate.findMany({
            where: { tenantId, candidateId: candidate.id },
            orderBy: { issuedAt: 'desc' },
            take: 10,
          }),
          this.prisma.studentLeaveApplication.findMany({
            where: { tenantId, candidateId: candidate.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          batchIds.length
            ? this.prisma.liveClass.findMany({
                where: {
                  tenantId,
                  batchId: { in: batchIds },
                  status: { in: [LiveClassStatus.SCHEDULED, LiveClassStatus.LIVE] },
                  endTime: { gte: now },
                },
                orderBy: { startTime: 'asc' },
                include: this.liveClassInclude,
              })
            : Promise.resolve([]),
          primaryBatch
            ? this.getTimetable(tenantId, primaryBatch.id)
            : Promise.resolve({ periods: [], slots: [], days: WEEKDAYS }),
        ]);

        const totalAtt = attendanceRecords.length;
        const presentAtt = attendanceRecords.filter(
          (r) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE,
        ).length;
        const attendancePercent = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null;

        const feeOutstanding = feeInvoices.reduce((s, inv) => {
          if (inv.status === 'PAID') return s;
          return s + Number(inv.totalAmount) - Number(inv.discountAmount) - Number(inv.paidAmount);
        }, 0);

        return {
          candidateId: candidate.id,
          name: `${candidate.user.firstName} ${candidate.user.lastName}`.trim(),
          relation: link.relation,
          batches: candidate.batchEnrollments.map((e) => ({
            id: e.batch.id,
            name: e.batch.name,
            className: e.batch.academicClass.name,
          })),
          attendancePercent,
          recentAttendance: attendanceRecords.slice(0, 10).map((r) => ({
            date: r.date.toISOString().slice(0, 10),
            status: r.status,
          })),
          recentResults: candidate.results.map((r) => ({
            examTitle: r.exam.title,
            percentage: r.percentage,
            rank: r.rank,
          })),
          pendingHomework: homeworks.filter((h) => !h.submissions.length).length,
          homeworks: homeworks.map((h) => ({
            id: h.id,
            title: h.title,
            dueDate: h.dueDate.toISOString(),
            subject: h.subject,
            mySubmission: h.submissions[0] ?? null,
          })),
          recentNotices: notices.slice(0, 5),
          reportCards: reportCards.map((rc) => ({
            id: rc.id,
            termName: rc.term.name,
            academicYear: rc.term.academicYear.name,
            overallGrade: rc.overallGrade,
            percentage: Number(rc.percentage),
          })),
          fees: {
            outstanding: feeOutstanding,
            invoices: feeInvoices.map((inv) => ({
              id: inv.id,
              invoiceNo: inv.invoiceNo,
              totalAmount: Number(inv.totalAmount),
              discountAmount: Number(inv.discountAmount),
              paidAmount: Number(inv.paidAmount),
              dueDate: inv.dueDate.toISOString().slice(0, 10),
              status: inv.status,
            })),
          },
          library: libraryIssues.map((issue) => ({
            id: issue.id,
            bookTitle: issue.book.title,
            dueDate: issue.dueDate.toISOString().slice(0, 10),
            status: issue.status,
          })),
          transport: transportAssignment
            ? {
                routeName: transportAssignment.route.name,
                routeCode: transportAssignment.route.code,
                startPoint: transportAssignment.route.startPoint,
                endPoint: transportAssignment.route.endPoint,
                stops: transportAssignment.route.stops.map((s) => ({
                  name: s.name,
                  pickUpTime: s.pickUpTime,
                })),
              }
            : null,
          calendarEvents: calendarEvents.map((ev) => ({
            id: ev.id,
            title: ev.title,
            startDate: ev.startDate.toISOString().slice(0, 10),
            endDate: ev.endDate?.toISOString().slice(0, 10) ?? null,
            eventType: ev.eventType,
            isHoliday: ev.isHoliday,
          })),
          certificates: certificates.map((c) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            certificateNo: c.certificateNo,
          })),
          leaveApplications: leaveApplications.map((l) => ({
            id: l.id,
            startDate: l.startDate.toISOString().slice(0, 10),
            endDate: l.endDate.toISOString().slice(0, 10),
            status: l.status,
            reason: l.reason,
          })),
          liveClasses: {
            live: liveClassRows
              .filter((c) => c.status === LiveClassStatus.LIVE)
              .map((c) => this.mapLiveClassForPortal(c)),
            upcoming: liveClassRows
              .filter((c) => c.status === LiveClassStatus.SCHEDULED)
              .map((c) => this.mapLiveClassForPortal(c)),
          },
          timetable,
        };
      }),
    );

    return { children };
  }

  // ─── Student school dashboard ──────────────────────────────────

  async getStudentSchoolDashboard(tenantId: string, userId: string) {
    const candidate = await this.getCandidateForUser(userId, tenantId);
    const batchIds = candidate.batchEnrollments.map((e) => e.batchId);
    const classIds = candidate.batchEnrollments.map((e) => e.batch.academicClass.id);
    const primaryBatch = candidate.batchEnrollments[0]?.batch;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const now = new Date();
    const calendarTo = new Date(now);
    calendarTo.setMonth(calendarTo.getMonth() + 2);

    const [
      timetable,
      attendanceRecords,
      homeworks,
      notices,
      liveClasses,
      reportCards,
      feeInvoices,
      libraryIssues,
      transportAssignment,
      calendarEvents,
      certificates,
      leaveApplications,
    ] = await Promise.all([
      primaryBatch
        ? this.getTimetable(tenantId, primaryBatch.id)
        : Promise.resolve({ periods: [], slots: [], days: WEEKDAYS }),
      this.prisma.attendanceRecord.findMany({
        where: { candidateId: candidate.id, date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'desc' },
      }),
      this.getStudentHomework(tenantId, userId),
      this.listNotices(tenantId, batchIds, classIds),
      this.getStudentLiveClasses(tenantId, userId),
      this.prisma.reportCard.findMany({
        where: { tenantId, candidateId: candidate.id, status: 'PUBLISHED' },
        include: { term: { include: { academicYear: true } } },
        orderBy: { issuedAt: 'desc' },
        take: 5,
      }),
      this.prisma.feeInvoice.findMany({
        where: { tenantId, candidateId: candidate.id },
        orderBy: { dueDate: 'desc' },
        take: 10,
      }),
      this.prisma.libraryIssue.findMany({
        where: { candidateId: candidate.id, status: 'ISSUED' },
        include: { book: true },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.transportAssignment.findUnique({
        where: { candidateId: candidate.id },
        include: { route: { include: { stops: { orderBy: { sequence: 'asc' } } } } },
      }),
      this.prisma.calendarEvent.findMany({
        where: { tenantId, startDate: { gte: now, lte: calendarTo } },
        orderBy: { startDate: 'asc' },
        take: 10,
      }),
      this.prisma.studentCertificate.findMany({
        where: { tenantId, candidateId: candidate.id },
        orderBy: { issuedAt: 'desc' },
        take: 10,
      }),
      this.prisma.studentLeaveApplication.findMany({
        where: { tenantId, candidateId: candidate.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalAtt = attendanceRecords.length;
    const presentAtt = attendanceRecords.filter(
      (r) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE,
    ).length;

    const feeOutstanding = feeInvoices.reduce((s, inv) => {
      if (inv.status === 'PAID') return s;
      return s + Number(inv.totalAmount) - Number(inv.discountAmount) - Number(inv.paidAmount);
    }, 0);

    return {
      candidateId: candidate.id,
      batch: primaryBatch
        ? {
            id: primaryBatch.id,
            name: primaryBatch.name,
            className: primaryBatch.academicClass.name,
          }
        : null,
      timetable,
      attendance: {
        percentage: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null,
        recent: attendanceRecords.slice(0, 10).map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
        })),
      },
      homeworks,
      notices,
      liveClasses,
      reportCards: reportCards.map((rc) => ({
        id: rc.id,
        termName: rc.term.name,
        academicYear: rc.term.academicYear.name,
        overallGrade: rc.overallGrade,
        percentage: Number(rc.percentage),
        issuedAt: rc.issuedAt,
      })),
      fees: {
        outstanding: feeOutstanding,
        invoices: feeInvoices.map((inv) => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          totalAmount: Number(inv.totalAmount),
          discountAmount: Number(inv.discountAmount),
          paidAmount: Number(inv.paidAmount),
          dueDate: inv.dueDate.toISOString().slice(0, 10),
          status: inv.status,
        })),
      },
      library: libraryIssues.map((issue) => ({
        id: issue.id,
        bookTitle: issue.book.title,
        dueDate: issue.dueDate.toISOString().slice(0, 10),
        status: issue.status,
      })),
      transport: transportAssignment
        ? {
            routeName: transportAssignment.route.name,
            routeCode: transportAssignment.route.code,
            startPoint: transportAssignment.route.startPoint,
            endPoint: transportAssignment.route.endPoint,
            stops: transportAssignment.route.stops.map((s) => ({
              name: s.name,
              pickUpTime: s.pickUpTime,
            })),
          }
        : null,
      calendarEvents: calendarEvents.map((ev) => ({
        id: ev.id,
        title: ev.title,
        startDate: ev.startDate.toISOString().slice(0, 10),
        endDate: ev.endDate?.toISOString().slice(0, 10) ?? null,
        eventType: ev.eventType,
        isHoliday: ev.isHoliday,
      })),
      certificates: certificates.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        certificateNo: c.certificateNo,
        issuedAt: c.issuedAt,
      })),
      leaveApplications: leaveApplications.map((l) => ({
        id: l.id,
        startDate: l.startDate.toISOString().slice(0, 10),
        endDate: l.endDate.toISOString().slice(0, 10),
        status: l.status,
        reason: l.reason,
      })),
    };
  }
}
