import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parsePage, parseLimit } from '../../common/utils/pagination.util';

@Injectable()
export class ResultsService {
  private readonly subjectiveTypes = ['SUBJECTIVE', 'CASE_STUDY', 'CODING', 'AUDIO', 'VIDEO'];

  constructor(private prisma: PrismaService) {}

  /** Teachers may only manage results for exams they created. */
  async assertTeacherOwnsExam(examId: string, teacherUserId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdById: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.createdById !== teacherUserId) {
      throw new ForbiddenException('You can only manage results for class tests you created');
    }
    return exam;
  }

  async assertTeacherOwnsSession(sessionId: string, teacherUserId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { examId: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.assertTeacherOwnsExam(session.examId, teacherUserId);
    return session;
  }

  async evaluateSession(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        responses: { include: { question: { include: { versions: { take: 1, orderBy: { versionNumber: 'desc' } } } } } },
        exam: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    let totalScore = 0;
    let maxScore = 0;

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: session.examId },
      include: { question: { include: { versions: { take: 1, orderBy: { versionNumber: 'desc' } } } } },
    });

    for (const eq of examQuestions) {
      const version = eq.question.versions[0];
      if (version) maxScore += version.marks;
    }

    for (const response of session.responses) {
      const version = response.question.versions[0];
      if (!version) continue;

      if (this.subjectiveTypes.includes(response.question.type)) {
        if (response.marksAwarded != null) {
          totalScore += response.marksAwarded;
        }
        continue;
      }

      if (!version.correctAnswer || !response.answer) continue;

      const { isCorrect, marks } = this.gradeAnswer(
        response.question.type,
        version.correctAnswer,
        response.answer,
        version.marks,
        version.negativeMarks || 0,
      );
      totalScore += Math.max(marks, 0);

      await this.prisma.sessionResponse.update({
        where: { id: response.id },
        data: { isCorrect, marksAwarded: marks },
      });
    }

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const hasUngraded = session.responses.some(
      (r) => this.subjectiveTypes.includes(r.question.type) && r.marksAwarded == null && r.answer,
    );

    return this.prisma.examResult.upsert({
      where: { sessionId },
      create: {
        sessionId,
        examId: session.examId,
        candidateId: session.candidateId,
        totalScore,
        maxScore,
        percentage,
        evaluationStatus: hasUngraded ? 'MANUAL_REVIEW' : 'AUTO_EVALUATED',
      },
      update: {
        totalScore,
        maxScore,
        percentage,
        evaluationStatus: hasUngraded ? 'MANUAL_REVIEW' : 'AUTO_EVALUATED',
      },
    });
  }

  async calculateRanks(examId: string) {
    const results = await this.prisma.examResult.findMany({
      where: { examId },
      orderBy: [{ totalScore: 'desc' }, { createdAt: 'asc' }],
    });

    const total = results.length;
    let currentRank = 0;
    let previousScore: number | null = null;

    for (let i = 0; i < results.length; i++) {
      const score = results[i].totalScore;
      if (previousScore === null || score < previousScore) {
        currentRank = i + 1;
        previousScore = score;
      }

      const percentile =
        total <= 1 ? 100 : ((total - currentRank) / (total - 1)) * 100;

      await this.prisma.examResult.update({
        where: { id: results[i].id },
        data: { rank: currentRank, percentile },
      });
    }

    return { examId, totalCandidates: total };
  }

  async publishResults(examId: string) {
    await this.calculateRanks(examId);
    await this.prisma.examResult.updateMany({
      where: { examId },
      data: { published: true, publishedAt: new Date(), evaluationStatus: 'PUBLISHED' },
    });
    return { examId, published: true };
  }

  async getExamResults(examId: string, page?: unknown, limit?: unknown) {
    const p = parsePage(page);
    const l = parseLimit(limit, 50);
    const [items, total] = await Promise.all([
      this.prisma.examResult.findMany({
        where: { examId },
        include: {
          candidate: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
        orderBy: { totalScore: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      this.prisma.examResult.count({ where: { examId } }),
    ]);
    return { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  private gradeAnswer(
    questionType: string,
    correctAnswer: unknown,
    givenAnswer: unknown,
    marks: number,
    negativeMarks: number,
  ): { isCorrect: boolean; marks: number } {
    const expected = this.normalizeAnswer(correctAnswer);
    const given = this.normalizeAnswer(givenAnswer);

    if (questionType === 'MSQ') {
      const expSet = new Set(expected);
      const givSet = new Set(given);
      const allCorrect = expected.every((a) => givSet.has(a));
      const noExtra = given.every((a) => expSet.has(a));
      const isCorrect = allCorrect && noExtra && expected.length > 0;
      if (isCorrect) return { isCorrect: true, marks };
      const partial = expected.filter((a) => givSet.has(a)).length;
      if (partial > 0 && !given.some((a) => !expSet.has(a))) {
        const partialMarks = (partial / expected.length) * marks;
        return { isCorrect: false, marks: partialMarks };
      }
      return { isCorrect: false, marks: -negativeMarks };
    }

    if (questionType === 'NUMERICAL') {
      const expNum = parseFloat(expected[0]);
      const givNum = parseFloat(given[0]);
      const isCorrect = !Number.isNaN(expNum) && !Number.isNaN(givNum)
        && Math.abs(expNum - givNum) < 0.001;
      return { isCorrect, marks: isCorrect ? marks : -negativeMarks };
    }

    if (['SUBJECTIVE', 'CASE_STUDY', 'CODING', 'AUDIO', 'VIDEO'].includes(questionType)) {
      return { isCorrect: false, marks: 0 };
    }

    const isCorrect = expected.length === 1 && given.length === 1 &&
      expected[0].toLowerCase() === given[0].toLowerCase();
    return { isCorrect, marks: isCorrect ? marks : -negativeMarks };
  }

  private normalizeAnswer(answer: unknown): string[] {
    if (!answer) return [];
    const raw = typeof answer === 'object' && answer !== null && 'value' in answer
      ? (answer as { value: unknown }).value
      : answer;
    if (Array.isArray(raw)) return raw.map(String);
    return [String(raw)];
  }

  async exportExamResultsCsv(examId: string) {
    const results = await this.prisma.examResult.findMany({
      where: { examId },
      include: {
        candidate: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        exam: { select: { code: true, title: true } },
      },
      orderBy: [{ rank: 'asc' }, { totalScore: 'desc' }],
    });

    const header = 'Rank,Candidate Name,Email,Score,Max Score,Percentage,Status,Published\n';
    const rows = results.map((r) => [
      r.rank ?? '',
      `"${r.candidate.user.firstName} ${r.candidate.user.lastName}"`,
      r.candidate.user.email,
      r.totalScore,
      r.maxScore,
      r.percentage.toFixed(2),
      r.evaluationStatus,
      r.published ? 'Yes' : 'No',
    ].join(','));
    return header + rows.join('\n');
  }

  async getMyResults(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) return { items: [] };

    const items = await this.prisma.examResult.findMany({
      where: { candidateId: candidate.id, published: true },
      include: { exam: { select: { title: true, code: true, settings: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const examIds = [...new Set(items.map((r) => r.examId))];
    const totals = await Promise.all(
      examIds.map(async (examId) => {
        const count = await this.prisma.examResult.count({
          where: { examId, published: true },
        });
        return [examId, count] as const;
      }),
    );
    const totalByExam = Object.fromEntries(totals);

    return {
      items: items.map((r) => ({
        ...r,
        totalCandidates: totalByExam[r.examId] ?? null,
      })),
    };
  }

  async getCertificate(userId: string, resultId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const result = await this.prisma.examResult.findFirst({
      where: { id: resultId, candidateId: candidate.id, published: true },
      include: {
        exam: { select: { title: true, code: true, settings: true } },
        candidate: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
    if (!result) throw new NotFoundException('Published result not found');

    const totalCandidates = await this.prisma.examResult.count({
      where: { examId: result.examId, published: true },
    });
    const settings = (result.exam.settings || {}) as Record<string, unknown>;
    const passingScore = (settings.passingScore as number) ?? 40;

    return {
      certificateId: result.id,
      certificateNumber: `CERT-${result.exam.code}-${result.id.slice(0, 8).toUpperCase()}`,
      candidateName: `${result.candidate.user.firstName} ${result.candidate.user.lastName}`,
      candidateEmail: result.candidate.user.email,
      examTitle: result.exam.title,
      examCode: result.exam.code,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      passingScore,
      rank: result.rank,
      percentile: result.percentile,
      totalCandidates,
      issuedAt: result.publishedAt ?? result.createdAt,
      verificationUrl: `/verify/certificate/${result.id}`,
    };
  }

  async verifyCertificate(resultId: string) {
    const result = await this.prisma.examResult.findFirst({
      where: { id: resultId, published: true },
      include: {
        exam: { select: { title: true, code: true, settings: true } },
        candidate: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!result) throw new NotFoundException('Certificate not found or not published');

    const settings = (result.exam.settings || {}) as Record<string, unknown>;
    const passingScore = (settings.passingScore as number) ?? 40;

    return {
      valid: true,
      certificateId: result.id,
      certificateNumber: `CERT-${result.exam.code}-${result.id.slice(0, 8).toUpperCase()}`,
      candidateName: `${result.candidate.user.firstName} ${result.candidate.user.lastName}`,
      examTitle: result.exam.title,
      examCode: result.exam.code,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      passingScore,
      passed: result.percentage >= passingScore,
      rank: result.rank,
      issuedAt: result.publishedAt ?? result.createdAt,
    };
  }

  async getSubjectiveResponses(examId: string) {
    return this.prisma.sessionResponse.findMany({
      where: {
        session: { examId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
        question: { type: { in: this.subjectiveTypes as never } },
      },
      include: {
        question: {
          include: { versions: { take: 1, orderBy: { versionNumber: 'desc' } } },
        },
        session: {
          include: {
            candidate: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async gradeResponse(sessionId: string, questionId: string, marksAwarded: number) {
    const response = await this.prisma.sessionResponse.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
      include: { question: true },
    });
    if (!response) throw new NotFoundException('Response not found');
    if (!this.subjectiveTypes.includes(response.question.type)) {
      throw new BadRequestException('Only subjective responses can be manually graded');
    }

    const version = await this.prisma.questionVersion.findFirst({
      where: { questionId },
      orderBy: { versionNumber: 'desc' },
    });
    const maxMarks = version?.marks ?? 0;
    if (marksAwarded < 0 || marksAwarded > maxMarks) {
      throw new BadRequestException(`Marks must be between 0 and ${maxMarks}`);
    }

    await this.prisma.sessionResponse.update({
      where: { sessionId_questionId: { sessionId, questionId } },
      data: {
        marksAwarded,
        isCorrect: marksAwarded > 0,
      },
    });

    return this.evaluateSession(sessionId);
  }
}
