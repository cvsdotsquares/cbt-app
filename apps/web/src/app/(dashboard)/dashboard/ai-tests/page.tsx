'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { aiApi, curriculumApi, batchesApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { AiTestQuestionsReview } from '@/components/admin/ai-test-questions-review';
import { cn } from '@/lib/utils';
import {
  Sparkles, BookOpen, Layers, Clock, Hash, Shield, Loader2,
  CheckCircle2, ArrowRight, GraduationCap, FileText,
} from 'lucide-react';

type TestMode = 'single' | 'all';

const STEPS = [
  { id: 1, label: 'Configure' },
  { id: 2, label: 'Generate' },
  { id: 3, label: 'Review' },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: 'Easy', hint: 'Recall & basic understanding' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Application & reasoning' },
  { value: 'HARD', label: 'Hard', hint: 'Analysis & multi-step' },
] as const;

const selectClass =
  'mt-1.5 flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function AiTestsPage() {
  const { accessToken } = useRequireAuth(true);
  const [createdExam, setCreatedExam] = useState<{
    id: string;
    title: string;
    questionCount: number;
  } | null>(null);
  const [mode, setMode] = useState<TestMode>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    title: 'Weekly Assessment',
    subjectId: '',
    batchId: '',
    questionCount: 10,
    questionsPerSubject: 5,
    difficulty: 'MEDIUM',
    syllabusScope: 'COMPLETED_ONLY',
    durationMinutes: 90,
    assignToBatch: true,
    questionTypes: ['MCQ'],
  });

  const { data: classes } = useQuery({
    queryKey: ['curriculum-classes'],
    queryFn: () => curriculumApi.getClasses(accessToken!) as Promise<{
      id: string; level: number;
      subjects: { id: string; name: string }[];
    }[]>,
    enabled: !!accessToken,
  });

  const { data: batches } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<{
      id: string; name: string;
      academicClass: { name: string; level: number };
      _count?: { enrollments: number };
    }[]>,
    enabled: !!accessToken,
  });

  const subjects = (classes ?? []).flatMap((c) =>
    c.subjects.map((s) => ({ ...s, classLevel: c.level })),
  );

  const selectedBatch = (batches ?? []).find((b) => b.id === form.batchId);
  const classSubjects = selectedBatch
    ? subjects.filter((s) => s.classLevel === selectedBatch.academicClass.level)
    : [];

  const selectedSubject = classSubjects.find((s) => s.id === form.subjectId)
    ?? subjects.find((s) => s.id === form.subjectId);

  const estimatedQuestions = useMemo(() => {
    if (mode === 'all') {
      return classSubjects.length * form.questionsPerSubject;
    }
    return form.questionCount;
  }, [mode, classSubjects.length, form.questionsPerSubject, form.questionCount]);

  const createMutation = useMutation({
    mutationFn: () => aiApi.createAiTest(accessToken!, {
      ...form,
      allSubjects: mode === 'all',
      subjectId: mode === 'single' ? form.subjectId : undefined,
      durationMinutes: mode === 'all' ? form.durationMinutes : Math.min(form.durationMinutes, 60),
    }),
    onSuccess: (data) => {
      const d = data as {
        exam?: { id: string; title: string };
        questionCount?: number;
        message?: string;
      };
      const examId = d.exam?.id;
      if (!examId) {
        toast({ title: 'Draft exam created', description: d.message, variant: 'destructive' });
        return;
      }
      setCreatedExam({
        id: examId,
        title: d.exam?.title ?? form.title,
        questionCount: d.questionCount ?? 0,
      });
      toast({
        title: 'Draft exam created',
        description: d.message ?? 'Review AI-generated questions below, then publish from Class Tests.',
      });
    },
    onError: (e: Error) => toast({ title: 'Could not create test', description: e.message, variant: 'destructive' }),
  });

  const canCreate = form.batchId && (mode === 'all' || form.subjectId) && !createdExam;
  const activeStep = createdExam ? 3 : createMutation.isPending ? 2 : 1;

  if (createdExam && accessToken) {
    return (
      <div className="space-y-8">
        <StepIndicator activeStep={3} />
        <PageHeader
          title="Review your test"
          highlight="test"
          description="Edit any AI-generated question or answer, then publish from Class Tests when you are satisfied."
          badge="Step 3 · Review"
        />
        <AiTestQuestionsReview
          accessToken={accessToken}
          examId={createdExam.id}
          examTitle={createdExam.title}
          questionCount={createdExam.questionCount}
          onCreateAnother={() => setCreatedExam(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StepIndicator activeStep={activeStep} />

      <PageHeader
        title="Create Class Test"
        highlight="Class Test"
        description="Build a NCERT-aligned draft test from uploaded books. Questions are generated only from indexed chapters your batch has studied."
        badge="NCERT · AI"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main form */}
        <div className="space-y-6">
          <Card className="surface-card overflow-hidden border-primary/10">
            <div className="h-1 bg-gradient-to-r from-violet-500 via-primary to-indigo-500" />
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Test type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeCard
                  active={mode === 'all'}
                  icon={Layers}
                  title="All subjects"
                  description="One combined exam — each subject becomes a section using studied chapters only."
                  onClick={() => setMode('all')}
                />
                <ModeCard
                  active={mode === 'single'}
                  icon={BookOpen}
                  title="One subject"
                  description="Focused test for a single subject from uploaded chapter content."
                  onClick={() => setMode('single')}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="test-title">Test name</Label>
                  <Input
                    id="test-title"
                    className="mt-1.5"
                    placeholder={mode === 'all' ? 'e.g. Weekly Test — All Subjects' : 'e.g. Social Science Unit Test'}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="batch">Class / Batch</Label>
                  <select
                    id="batch"
                    className={selectClass}
                    value={form.batchId}
                    onChange={(e) => setForm({ ...form, batchId: e.target.value, subjectId: '' })}
                  >
                    <option value="">Choose batch</option>
                    {(batches ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.academicClass.name} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {mode === 'single' && (
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <select
                      id="subject"
                      className={selectClass}
                      value={form.subjectId}
                      onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                    >
                      <option value="">Choose subject</option>
                      {(classSubjects.length ? classSubjects : subjects).map((s) => (
                        <option key={s.id} value={s.id}>Class {s.classLevel} — {s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {mode === 'all' ? (
                    <div>
                      <Label htmlFor="q-per-subject">Questions per subject</Label>
                      <Input
                        id="q-per-subject"
                        className="mt-1.5"
                        type="number"
                        min={2}
                        max={15}
                        value={form.questionsPerSubject}
                        onChange={(e) => setForm({ ...form, questionsPerSubject: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="q-count">Total questions</Label>
                      <Input
                        id="q-count"
                        className="mt-1.5"
                        type="number"
                        min={5}
                        max={30}
                        value={form.questionCount}
                        onChange={(e) => setForm({ ...form, questionCount: parseInt(e.target.value) || 10 })}
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      className="mt-1.5"
                      type="number"
                      min={15}
                      max={180}
                      value={form.durationMinutes}
                      onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 90 })}
                    />
                  </div>
                </div>
              </div>

              {/* Advanced */}
              <div className="rounded-xl border bg-muted/20">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  Advanced options
                  <span className="text-muted-foreground">{showAdvanced ? 'Hide' : 'Show'}</span>
                </button>
                {showAdvanced && (
                  <div className="space-y-4 border-t px-4 pb-4 pt-4">
                    <div>
                      <Label className="mb-2 block">Difficulty</Label>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setForm({ ...form, difficulty: d.value })}
                            className={cn(
                              'rounded-lg border p-3 text-left transition-all',
                              form.difficulty === d.value
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                : 'hover:border-primary/30 hover:bg-muted/50',
                            )}
                          >
                            <p className="text-sm font-medium">{d.label}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{d.hint}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.assignToBatch}
                        onChange={(e) => setForm({ ...form, assignToBatch: e.target.checked })}
                        className="rounded"
                      />
                      Auto-assign to all students in the batch
                    </label>
                  </div>
                )}
              </div>

              <Button
                className="h-12 w-full text-base shadow-md"
                size="lg"
                disabled={!canCreate || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating from your books…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate draft exam
                    <ArrowRight className="ml-2 h-4 w-4 opacity-70" />
                  </>
                )}
              </Button>

              {createMutation.isPending && (
                <p className="text-center text-sm text-muted-foreground">
                  Reading uploaded chapters and framing questions — usually 30–90 seconds.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/15 bg-primary/[0.03]">
            <CardContent className="flex gap-3 p-4 text-sm">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Strict document-only AI</p>
                <p className="text-muted-foreground">
                  Questions are retrieved from your indexed PDFs only — not from the internet or a static question bank.
                  Mark chapters as studied on{' '}
                  <Link href="/dashboard/batches" className="font-medium text-primary underline-offset-2 hover:underline">
                    Classes &amp; Batches
                  </Link>{' '}
                  before generating.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Test summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SummaryRow
                icon={Hash}
                label="Est. questions"
                value={selectedBatch ? String(estimatedQuestions) : '—'}
              />
              <SummaryRow
                icon={Clock}
                label="Duration"
                value={`${form.durationMinutes} min`}
              />
              <SummaryRow
                icon={GraduationCap}
                label="Batch"
                value={selectedBatch ? `${selectedBatch.academicClass.name} · ${selectedBatch.name}` : 'Not selected'}
              />

              {mode === 'all' && classSubjects.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subjects included
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {classSubjects.map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-xs font-normal">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'single' && selectedSubject && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                  <Badge variant="secondary">{selectedSubject.name}</Badge>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Checklist
                </p>
                <ul className="space-y-2">
                  <ChecklistItem done={!!form.batchId} label="Batch selected" />
                  <ChecklistItem done={mode === 'all' || !!form.subjectId} label="Subject configured" />
                  <ChecklistItem done={!!form.title.trim()} label="Test name set" />
                  <ChecklistItem
                    done={mode === 'all' ? classSubjects.length > 0 : !!form.subjectId}
                    label="Subjects available for class"
                  />
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <p className="font-medium">Before you generate</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Upload books on{' '}
                    <Link href="/dashboard/materials" className="text-primary hover:underline">Books &amp; Notes</Link>
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Mark studied chapters on Classes &amp; Batches</span>
                </li>
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Review &amp; edit questions before publishing</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex flex-1 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                activeStep >= step.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {activeStep > step.id ? <CheckCircle2 className="h-4 w-4" /> : step.id}
            </div>
            <span
              className={cn(
                'hidden truncate text-sm font-medium sm:inline',
                activeStep >= step.id ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'h-px flex-1',
                activeStep > step.id ? 'bg-primary/50' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Layers;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 text-left transition-all',
        active
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
          : 'hover:border-primary/30 hover:bg-muted/30',
      )}
    >
      <div
        className={cn(
          'mb-3 flex h-10 w-10 items-center justify-center rounded-lg',
          active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <CheckCircle2
        className={cn('h-4 w-4 shrink-0', done ? 'text-emerald-600' : 'text-muted-foreground/40')}
      />
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  );
}
