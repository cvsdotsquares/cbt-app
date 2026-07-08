import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RagService, RetrievedChunk } from '../rag/rag.service';
import { QuestionsService } from '../questions/questions.service';
import { ExamsService } from '../exams/exams.service';
import { GeneratedQuestion } from './ai.service';
import { QuestionType, QuestionDifficulty } from '@prisma/client';
import { createHash } from 'crypto';

export interface RagGenerateParams {
  tenantId: string;
  userId: string;
  subjectId: string;
  batchId?: string;
  chapterIds?: string[];
  topicIds?: string[];
  syllabusScope?: 'COMPLETED_ONLY' | 'SELECTED' | 'ALL';
  count?: number;
  difficulty?: string;
  types?: string[];
  query?: string;
}

@Injectable()
export class AiTestsService {
  private readonly logger = new Logger(AiTestsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private ragService: RagService,
    private questionsService: QuestionsService,
    private examsService: ExamsService,
  ) {}

  async generateRagQuestions(params: RagGenerateParams) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: params.subjectId },
      include: { academicClass: true },
    });
    if (!subject) throw new BadRequestException('Subject not found');

    const uploaded = await this.ragService.getUploadedChapterIds(
      params.tenantId,
      subject.academicClassId,
      params.subjectId,
    );

    if (!uploaded.size) {
      throw new BadRequestException(
        `No uploaded documents for Class ${subject.academicClass.level} ${subject.name}. `
        + 'Upload and tag books on Books & Notes first.',
      );
    }

    let chapterIds = (params.chapterIds ?? []).filter((id) => uploaded.has(id));

    if (params.syllabusScope === 'COMPLETED_ONLY' && params.batchId) {
      const completed = await this.ragService.getCompletedChapterIds(params.batchId);
      chapterIds = chapterIds.length
        ? chapterIds.filter((id) => completed.includes(id))
        : completed.filter((id) => uploaded.has(id));
      if (!chapterIds.length) {
        throw new BadRequestException(
          'No studied chapters with uploaded documents. Mark chapters on Classes & Batches '
          + 'and ensure matching books are uploaded.',
        );
      }
    } else if (!chapterIds.length) {
      chapterIds = [...uploaded];
    }

    const query = params.query
      || `Key facts, events, dates, definitions, causes and effects from ${subject.name} `
      + `Class ${subject.academicClass.level} textbook for examination questions`;

    const chunks = await this.ragService.retrieveStrict({
      tenantId: params.tenantId,
      query,
      academicClassId: subject.academicClassId,
      subjectId: params.subjectId,
      chapterIds,
      topicIds: params.topicIds,
      limit: 20,
    });

    if (!chunks.length) {
      throw new BadRequestException(
        'Not enough content in uploaded documents for the selected chapters. '
        + 'Upload more material or select different chapters.',
      );
    }

    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadRequestException('OpenAI API key is required for AI question generation');
    }

    const recentHashes = await this.getRecentQuestionHashes(params.tenantId, params.batchId);
    const questions = await this.generateFromContext(chunks, params, subject.name);
    const deduped = questions.filter((q) => {
      const hash = this.hashQuestion(q.content.text);
      return !recentHashes.has(hash);
    });

    if (!deduped.length) {
      throw new BadRequestException('Could not generate unique questions from uploaded content. Try different chapters.');
    }

    const avgConfidence = chunks.reduce((s, c) => s + c.score, 0) / chunks.length;

    return {
      questions: deduped.slice(0, params.count ?? 10),
      source: 'rag' as const,
      chunks,
      sourceChunkIds: chunks.map((c) => c.id),
      sourceMaterialIds: [...new Set(chunks.map((c) => c.materialId))],
      sourceChapterId: chapterIds[0],
      confidenceScore: avgConfidence,
      contextUsed: chunks.length,
    };
  }

  private async getRecentQuestionHashes(tenantId: string, batchId?: string): Promise<Set<string>> {
    const records = await this.prisma.generatedQuestionRecord.findMany({
      where: { tenantId, ...(batchId ? { batchId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { questionHash: true },
    });
    return new Set(records.map((r) => r.questionHash));
  }

  hashQuestion(text: string): string {
    return createHash('sha256').update(text.toLowerCase().trim()).digest('hex').slice(0, 16);
  }

  private normalizeQuestionType(raw: string | undefined, fallback: string): QuestionType {
    const key = (raw || fallback).toUpperCase().replace(/[\s-]+/g, '_');
    const aliases: Record<string, QuestionType> = {
      MCQ: 'MCQ',
      MULTIPLE_CHOICE: 'MCQ',
      MULTIPLECHOICE: 'MCQ',
      MSQ: 'MSQ',
      MULTIPLE_SELECT: 'MSQ',
      MULTIPLESELECT: 'MSQ',
      ASSERTION_REASON: 'ASSERTION_REASON',
      NUMERICAL: 'NUMERICAL',
      FILL_BLANK: 'FILL_BLANK',
      FILL_IN_THE_BLANK: 'FILL_BLANK',
      SUBJECTIVE: 'SUBJECTIVE',
      CASE_STUDY: 'MCQ',
    };
    return aliases[key] ?? (fallback as QuestionType) ?? 'MCQ';
  }

  private normalizeDifficulty(raw: string | undefined, fallback: string): QuestionDifficulty {
    const key = (raw || fallback).toUpperCase();
    const aliases: Record<string, QuestionDifficulty> = {
      EASY: 'EASY',
      MEDIUM: 'MEDIUM',
      HARD: 'HARD',
      EXPERT: 'EXPERT',
    };
    return aliases[key] ?? (fallback as QuestionDifficulty) ?? 'MEDIUM';
  }

  private normalizeGeneratedQuestion(
    q: GeneratedQuestion & { explanation?: string },
    ctx: { subjectName: string; index: number; defaultType: string; defaultDifficulty: string },
  ): GeneratedQuestion & { explanation?: string } | null {
    const options = q.options || {};
    const normalizedOptions: Record<string, string> = {
      a: String(options.a ?? options.A ?? '').trim(),
      b: String(options.b ?? options.B ?? '').trim(),
      c: String(options.c ?? options.C ?? '').trim(),
      d: String(options.d ?? options.D ?? '').trim(),
    };

    let correctValue = q.correctAnswer?.value ?? 'a';
    if (Array.isArray(correctValue)) {
      correctValue = String(correctValue[0] ?? 'a').toLowerCase();
    } else {
      correctValue = String(correctValue).toLowerCase();
    }
    if (!['a', 'b', 'c', 'd'].includes(correctValue)) correctValue = 'a';

    const rawTitle = q.title?.trim() ?? '';
    const rawText = q.content?.text?.trim() ?? '';
    if (!rawText) return null;

    const text = rawText;

    if (!this.isValidQuestionStem(text, rawTitle)) {
      this.logger.warn(`Rejected low-quality AI question: "${text.slice(0, 80)}"`);
      return null;
    }

    if (!this.areValidOptions(normalizedOptions, correctValue)) {
      this.logger.warn(`Rejected AI question with invalid options: "${text.slice(0, 60)}"`);
      return null;
    }

    const shuffled = this.shuffleMcqOptions(normalizedOptions, correctValue);

    const title = rawTitle && rawTitle.toLowerCase() !== text.toLowerCase()
      ? rawTitle.slice(0, 120)
      : `${ctx.subjectName} — Q${ctx.index + 1}`;

    return {
      title,
      type: this.normalizeQuestionType(q.type, ctx.defaultType),
      difficulty: this.normalizeDifficulty(q.difficulty, ctx.defaultDifficulty),
      content: { text },
      options: shuffled.options,
      correctAnswer: { value: shuffled.correct },
      marks: q.marks ?? 2,
      negativeMarks: q.negativeMarks ?? 0.5,
      explanation: q.explanation,
    };
  }

  /** Reject chapter headings, topic labels, and stems that are not real exam questions. */
  private isValidQuestionStem(text: string, title?: string): boolean {
    const stem = text.trim();
    if (stem.length < 30) return false;

    const lower = stem.toLowerCase();
    const titleLower = title?.trim().toLowerCase();

    if (titleLower && lower === titleLower) return false;
    if (/^(chapter|unit|section|topic|lesson)\s*\d+/i.test(stem) && !stem.includes('?')) return false;

    const questionSignals = [
      '?', 'which', 'what', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
      'choose', 'select', 'identify', 'name the', 'state whether', 'assertion',
      'fill in', 'correct statement', 'incorrect statement', 'true or false',
      'best describes', 'main cause', 'main reason', 'referred to', 'following',
      'according to', 'based on', 'consider the', 'pick the', 'find the',
      'was the', 'were the', 'did the', 'does the', 'is the', 'are the',
      'explain', 'define', 'match', 'arrange', 'give reason',
    ];
    const hasQuestionSignal = questionSignals.some((s) => lower.includes(s));

    const wordCount = stem.split(/\s+/).filter(Boolean).length;
    // Short phrase without question structure = likely a chapter title
    if (wordCount <= 8 && !hasQuestionSignal) return false;

    // Heading-like: title case short phrase, no question mark, no question words
    if (!stem.includes('?') && !hasQuestionSignal && wordCount <= 10) return false;

    return true;
  }

  private areValidOptions(options: Record<string, string>, correct: string): boolean {
    const values = Object.values(options);
    if (values.some((v) => !v || v.length < 2)) return false;
    if (new Set(values.map((v) => v.toLowerCase())).size < 4) return false;
    if (!options[correct]) return false;
    return true;
  }

  /** Randomize option order so the correct answer is not always displayed as A. */
  private shuffleMcqOptions(
    options: Record<string, string>,
    correct: string,
  ): { options: Record<string, string>; correct: string } {
    const keys = ['a', 'b', 'c', 'd'] as const;
    const entries = keys.map((key) => ({ key, value: options[key] }));
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    const shuffled: Record<string, string> = {};
    let newCorrect = correct;
    entries.forEach((entry, index) => {
      const newKey = keys[index];
      shuffled[newKey] = entry.value;
      if (entry.key === correct) newCorrect = newKey;
    });
    return { options: shuffled, correct: newCorrect };
  }

  private buildQuestionGenerationPrompts(
    subjectName: string,
    difficulty: string,
    count: number,
    types: string[],
    context: string,
    retryNote?: string,
  ) {
    const typeInstructions: Record<string, string> = {
      MCQ: 'Multiple choice with exactly 4 options (a,b,c,d), one correct.',
      MSQ: 'Multiple select with 4 options, 2+ correct.',
      ASSERTION_REASON: 'Assertion-Reason format with 4 standard options.',
      NUMERICAL: 'Numerical answer question with 4 options.',
      FILL_BLANK: 'Fill in the blank with 4 options.',
      CASE_STUDY: 'Case-based question with scenario and 4 options.',
      SUBJECTIVE: 'Short answer subjective question.',
    };

    const systemPrompt = `You are an expert school examination paper setter (NCERT / CBSE style).

You receive excerpts ONLY from uploaded textbooks. Generate exam questions STRICTLY from those excerpts.

CRITICAL RULES FOR content.text (the question shown to students):
1. content.text MUST be a complete, self-contained question sentence (or two) that a student can answer.
2. NEVER use a chapter name, section title, or topic label as content.text.
3. NEVER copy headings like "Nazism and Hitler's Rise" or "Forest Society and Colonialism" as the question.
4. title is an internal short label for teachers only — content.text is what students see.
5. Each question must test a specific fact, concept, cause-effect, date, person, event, or definition FROM the source text.
6. All four options must be plausible and related to the question — not random unrelated terms.
7. Options must be full phrases or clear answers, not bare chapter names.
8. Do NOT use outside knowledge. If the source lacks enough detail for a good question, omit that question.

BAD example (NEVER do this):
title: "Nazism and Hitler's Rise"
content.text: "Nazism and Hitler's Rise"
options: Communism, Fascism, Liberalism, Socialism

GOOD example:
title: "Nazi ideology"
content.text: "Which ideology did Adolf Hitler and the Nazi Party promote in Germany after World War I, emphasizing extreme nationalism and anti-Semitism?"
options: a) Democracy, b) Fascism, c) Socialism, d) Communism

Question types: ${types.map((t) => typeInstructions[t] || t).join('; ')}`;

    const userPrompt = `Subject: ${subjectName}
Difficulty: ${difficulty}
Count: ${count}
${retryNote ? `\nRETRY NOTE: ${retryNote}\n` : ''}
SOURCE CONTEXT:
${context}

Generate exactly ${count} high-quality MCQ-style questions grounded in the source text.
Return JSON: { "questions": [ ... ] }
Each item: title (short admin label), content.text (full student-facing question, min 30 chars),
type (${types.join('|')}), difficulty (EASY|MEDIUM|HARD),
options {a,b,c,d}, correctAnswer {value: "a"|"b"|"c"|"d"}, marks, negativeMarks
Vary the correct option across questions — do not always use "a".`;

    return { systemPrompt, userPrompt };
  }

  private async callQuestionGenerationApi(
    systemPrompt: string,
    userPrompt: string,
    count: number,
    types: string[],
  ): Promise<(GeneratedQuestion & { explanation?: string })[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadRequestException('OpenAI API key is required for AI question generation');
    }

    const baseUrl = this.config.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const model = this.config.get('OPENAI_MODEL') || 'gpt-4o-mini';
    const isMsq = types.includes('MSQ');

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'rag_exam_questions',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      type: { type: 'string' },
                      difficulty: { type: 'string' },
                      content: {
                        type: 'object',
                        properties: { text: { type: 'string' } },
                        required: ['text'],
                        additionalProperties: false,
                      },
                      options: {
                        type: 'object',
                        properties: {
                          a: { type: 'string' },
                          b: { type: 'string' },
                          c: { type: 'string' },
                          d: { type: 'string' },
                        },
                        required: ['a', 'b', 'c', 'd'],
                        additionalProperties: false,
                      },
                      correctAnswer: {
                        type: 'object',
                        properties: {
                          value: isMsq
                            ? { type: 'array', items: { type: 'string', enum: ['a', 'b', 'c', 'd'] } }
                            : { type: 'string', enum: ['a', 'b', 'c', 'd'] },
                        },
                        required: ['value'],
                        additionalProperties: false,
                      },
                      marks: { type: 'number' },
                      negativeMarks: { type: 'number' },
                    },
                    required: ['title', 'content', 'options', 'correctAnswer', 'marks', 'negativeMarks', 'type', 'difficulty'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['questions'],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0].message.content) as {
      questions?: (GeneratedQuestion & { explanation?: string })[];
      error?: string;
    };

    if (parsed.error || !parsed.questions?.length) {
      throw new BadRequestException(
        parsed.error || 'Insufficient content in uploaded documents to generate questions',
      );
    }

    return parsed.questions.slice(0, count);
  }

  private async generateFromContext(
    chunks: RetrievedChunk[],
    params: RagGenerateParams,
    subjectName: string,
  ): Promise<GeneratedQuestion[]> {
    const count = params.count ?? 10;
    const types = params.types ?? ['MCQ'];
    const difficulty = params.difficulty ?? 'MEDIUM';

    const context = chunks.map((c, i) => `[Source ${i + 1} | chunk:${c.id}]: ${c.content}`).join('\n\n');

    const { systemPrompt, userPrompt } = this.buildQuestionGenerationPrompts(
      subjectName, difficulty, count, types, context,
    );

    try {
      const raw = await this.callQuestionGenerationApi(systemPrompt, userPrompt, count, types);
      let normalized = raw
        .map((q, i) => this.normalizeGeneratedQuestion(q, {
          subjectName,
          index: i,
          defaultType: types[i % types.length],
          defaultDifficulty: difficulty,
        }))
        .filter((q): q is GeneratedQuestion => q !== null);

      if (normalized.length < count) {
        const need = count - normalized.length;
        const retry = this.buildQuestionGenerationPrompts(
          subjectName,
          difficulty,
          need,
          types,
          context,
          `Previous output had ${raw.length - normalized.length} invalid questions that were chapter titles or not proper questions. `
          + 'Each content.text must be a full interrogative sentence testing content from the source. '
          + 'Do NOT repeat chapter or section names as questions.',
        );
        const retryRaw = await this.callQuestionGenerationApi(
          retry.systemPrompt,
          retry.userPrompt,
          need,
          types,
        );
        const retryNormalized = retryRaw
          .map((q, i) => this.normalizeGeneratedQuestion(q, {
            subjectName,
            index: normalized.length + i,
            defaultType: types[(normalized.length + i) % types.length],
            defaultDifficulty: difficulty,
          }))
          .filter((q): q is GeneratedQuestion => q !== null);
        normalized = [...normalized, ...retryNormalized];
      }

      if (!normalized.length) {
        throw new BadRequestException(
          'AI generated invalid questions (chapter titles instead of real questions). '
          + 'Try again or upload more detailed chapter content.',
        );
      }

      return normalized.slice(0, count);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(`RAG generation failed: ${e}`);
      throw new BadRequestException('AI could not generate questions from uploaded documents. Try again or upload more content.');
    }
  }

  private async saveGeneratedQuestion(
    tenantId: string,
    userId: string,
    gq: GeneratedQuestion,
    generated: {
      sourceChunkIds: string[];
      sourceMaterialIds?: string[];
      sourceChapterId?: string;
      confidenceScore?: number;
    },
    batchId?: string,
  ) {
    const text = gq.content?.text?.trim();
    if (!text || !this.isValidQuestionStem(text, gq.title)) {
      throw new BadRequestException('Refusing to save invalid AI question without a proper question stem');
    }

    const q = await this.questionsService.create(tenantId, userId, {
      type: this.normalizeQuestionType(gq.type, 'MCQ'),
      difficulty: this.normalizeDifficulty(gq.difficulty, 'MEDIUM'),
      title: gq.title,
      content: { text },
      options: gq.options,
      correctAnswer: gq.correctAnswer,
      marks: gq.marks,
      negativeMarks: gq.negativeMarks,
      tags: ['ai-generated', 'upload-sourced'],
    });

    const versionId = q.versions?.[0]?.id;
    if (versionId) {
      await this.prisma.question.update({
        where: { id: q.id },
        data: { currentVersionId: versionId },
      });
    }

    await this.prisma.generatedQuestionRecord.create({
      data: {
        tenantId,
        questionHash: this.hashQuestion(text),
        questionId: q.id,
        sourceChunkIds: generated.sourceChunkIds,
        sourceMaterialIds: generated.sourceMaterialIds ?? [],
        sourceChapterId: generated.sourceChapterId,
        confidenceScore: generated.confidenceScore,
        batchId,
      },
    });

    return q;
  }

  async createAiTest(
    tenantId: string,
    userId: string,
    config: {
      title: string;
      batchId?: string;
      subjectId?: string;
      allSubjects?: boolean;
      chapterIds?: string[];
      topicIds?: string[];
      questionCount?: number;
      questionsPerSubject?: number;
      difficulty?: string;
      questionTypes?: string[];
      syllabusScope?: string;
      durationMinutes?: number;
      assignToBatch?: boolean;
    },
  ) {
    if (config.allSubjects && config.batchId) {
      return this.createCombinedAiTest(tenantId, userId, config);
    }
    if (!config.subjectId) {
      throw new BadRequestException('Choose a subject or enable all subjects');
    }

    const generated = await this.generateRagQuestions({
      tenantId,
      userId,
      subjectId: config.subjectId,
      batchId: config.batchId,
      chapterIds: config.chapterIds,
      topicIds: config.topicIds,
      syllabusScope: (config.syllabusScope as RagGenerateParams['syllabusScope']) ?? 'COMPLETED_ONLY',
      count: config.questionCount ?? 10,
      difficulty: config.difficulty ?? 'MEDIUM',
      types: config.questionTypes ?? ['MCQ'],
    });

    const now = new Date();
    const end = new Date(now.getTime() + (config.durationMinutes ?? 60) * 60 * 1000);
    const code = `AI-${Date.now().toString(36).toUpperCase()}`;

    const exam = await this.examsService.create(tenantId, userId, {
      title: config.title,
      code,
      type: 'AI_ASSESSMENT',
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      settings: {
        durationMinutes: config.durationMinutes ?? 60,
        aiGenerated: true,
        subjectId: config.subjectId,
        chapterIds: config.chapterIds,
      },
      securityPolicy: { proctoringEnabled: false, fullscreen: false },
      sections: [{ name: 'Section A', orderIndex: 0, durationMinutes: config.durationMinutes ?? 60 }],
    });

    const section = exam.sections[0];
    const questionIds: string[] = [];

    for (const gq of generated.questions) {
      const q = await this.saveGeneratedQuestion(tenantId, userId, gq, generated, config.batchId);

      await this.prisma.examQuestion.create({
        data: {
          examId: exam.id,
          sectionId: section.id,
          questionId: q.id,
          orderIndex: questionIds.length,
          marks: gq.marks,
          negativeMarks: gq.negativeMarks,
        },
      });

      questionIds.push(q.id);
    }

    await this.prisma.aiTestConfig.create({
      data: {
        tenantId,
        batchId: config.batchId,
        subjectId: config.subjectId,
        title: config.title,
        chapterIds: config.chapterIds ?? [],
        topicIds: config.topicIds ?? [],
        questionCount: config.questionCount ?? 10,
        questionTypes: config.questionTypes ?? ['MCQ'],
        syllabusScope: config.syllabusScope ?? 'COMPLETED_ONLY',
        examId: exam.id,
        createdById: userId,
      },
    });

    if (config.assignToBatch && config.batchId) {
      const enrollments = await this.prisma.batchEnrollment.findMany({
        where: { batchId: config.batchId },
      });
      const candidateIds = enrollments.map((e) => e.candidateId);
      if (candidateIds.length) {
        await this.examsService.assignCandidates(exam.id, tenantId, candidateIds);
      }
    }

    // Draft exam — admin must review and publish from Exams
    return {
      exam: { ...exam, status: 'DRAFT' },
      questionCount: questionIds.length,
      source: generated.source,
      contextUsed: generated.contextUsed,
      sourceMaterialIds: generated.sourceMaterialIds,
      confidenceScore: generated.confidenceScore,
      message: 'Draft exam created from uploaded documents. Review questions, then publish from Exams.',
    };
  }

  /** One exam, all subjects — questions only from chapters marked studied for that batch */
  async createCombinedAiTest(
    tenantId: string,
    userId: string,
    config: {
      title: string;
      batchId?: string;
      questionsPerSubject?: number;
      questionCount?: number;
      difficulty?: string;
      questionTypes?: string[];
      syllabusScope?: string;
      durationMinutes?: number;
      assignToBatch?: boolean;
    },
  ) {
    if (!config.batchId) {
      throw new BadRequestException('Select a batch for the combined test');
    }

    const studied = await this.ragService.getStudiedChaptersBySubject(tenantId, config.batchId);
    if (!studied.length) {
      throw new BadRequestException(
        'No studied chapters with uploaded documents. Upload books, mark chapters studied, then retry.',
      );
    }

    const perSubject = config.questionsPerSubject
      ?? Math.max(3, Math.floor((config.questionCount ?? 20) / studied.length));

    const now = new Date();
    const duration = config.durationMinutes ?? 90;
    const end = new Date(now.getTime() + duration * 60 * 1000);
    const code = `AI-ALL-${Date.now().toString(36).toUpperCase()}`;

    const exam = await this.examsService.create(tenantId, userId, {
      title: config.title,
      code,
      type: 'AI_ASSESSMENT',
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      settings: {
        durationMinutes: duration,
        aiGenerated: true,
        combinedSubjects: true,
        batchId: config.batchId,
        subjects: studied.map((s) => s.subjectName),
      },
      securityPolicy: { proctoringEnabled: false, fullscreen: false },
      sections: studied.map((s, i) => ({
        name: s.subjectName,
        orderIndex: i,
        durationMinutes: duration,
      })),
    });

    let totalQuestions = 0;
    let orderIndex = 0;
    const scope = (config.syllabusScope as RagGenerateParams['syllabusScope']) ?? 'COMPLETED_ONLY';

    for (let si = 0; si < studied.length; si++) {
      const { subjectId, subjectName, chapterIds } = studied[si];
      const section = exam.sections[si];
      if (!section) continue;

      const generated = await this.generateRagQuestions({
        tenantId,
        userId,
        subjectId,
        batchId: config.batchId,
        chapterIds,
        syllabusScope: scope,
        count: perSubject,
        difficulty: config.difficulty ?? 'MEDIUM',
        types: config.questionTypes ?? ['MCQ'],
      });

      for (const gq of generated.questions) {
        const q = await this.saveGeneratedQuestion(tenantId, userId, gq, generated, config.batchId);

        await this.prisma.examQuestion.create({
          data: {
            examId: exam.id,
            sectionId: section.id,
            questionId: q.id,
            orderIndex: orderIndex++,
            marks: gq.marks,
            negativeMarks: gq.negativeMarks,
          },
        });

        totalQuestions++;
      }
    }

    await this.prisma.aiTestConfig.create({
      data: {
        tenantId,
        batchId: config.batchId,
        title: config.title,
        chapterIds: studied.flatMap((s) => s.chapterIds),
        questionCount: totalQuestions,
        questionTypes: config.questionTypes ?? ['MCQ'],
        syllabusScope: config.syllabusScope ?? 'COMPLETED_ONLY',
        examId: exam.id,
        createdById: userId,
        difficultyMix: { perSubject, subjects: studied.map((s) => s.subjectName) },
      },
    });

    if (config.assignToBatch !== false) {
      const enrollments = await this.prisma.batchEnrollment.findMany({
        where: { batchId: config.batchId },
      });
      const candidateIds = enrollments.map((e) => e.candidateId);
      if (candidateIds.length) {
        await this.examsService.assignCandidates(exam.id, tenantId, candidateIds);
      }
    }

    return {
      exam: { ...exam, status: 'DRAFT' },
      questionCount: totalQuestions,
      subjects: studied.map((s) => ({
        name: s.subjectName,
        studiedChapters: s.chapterIds.length,
        questions: perSubject,
      })),
      message: `Draft combined exam (${totalQuestions} questions). Review and publish from Exams.`,
    };
  }

  async generateExplanation(questionText: string, correctAnswer: string, chunks?: RetrievedChunk[]) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    const context = chunks?.map((c) => c.content).join('\n') ?? '';

    if (!apiKey) {
      return { explanation: `The correct answer is ${correctAnswer}. Review the NCERT chapter for detailed understanding.` };
    }

    const baseUrl = this.config.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: this.config.get('OPENAI_MODEL') || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Explain NCERT concepts clearly for Class 9-12 students. Use the source context.' },
          { role: 'user', content: `Question: ${questionText}\nCorrect: ${correctAnswer}\nContext: ${context}\nProvide step-by-step explanation.` },
        ],
        max_tokens: 500,
      }),
    });

    if (!res.ok) return { explanation: `The correct answer is ${correctAnswer}.` };
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return { explanation: data.choices[0].message.content };
  }
}
