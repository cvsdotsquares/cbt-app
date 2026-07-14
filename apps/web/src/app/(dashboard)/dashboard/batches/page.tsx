'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/layout/data-table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { batchesApi, curriculumApi, candidatesApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import {
  School, Users, CheckCircle2, Clock, Circle, Plus, Search,
  GraduationCap, BookOpen, UserPlus, Sparkles, ChevronRight, Trash2, Pencil, Upload,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { isTeacherOnly, normalizeRoles } from '@/lib/roles';

type Batch = {
  id: string;
  name: string;
  academicYear: string;
  academicClass: { id: string; name: string; level: number };
  _count: { enrollments: number };
};

type BatchForm = { name: string; academicYear: string; academicClassId: string };

type SyllabusSubject = {
  subject: { id: string; name: string };
  chapters: {
    id: string;
    number: number;
    title: string;
    status: string;
    topics?: { id: string; title: string; status?: string }[];
  }[];
};

type TabId = 'students' | 'syllabus';

const STATUS_CONFIG = {
  COMPLETED: {
    icon: CheckCircle2,
    label: 'Done',
    badge: 'success' as const,
    dot: 'bg-primary',
    active: 'bg-primary text-primary-foreground shadow-sm shadow-primary/25',
    labelTone: 'text-primary',
  },
  IN_PROGRESS: {
    icon: Clock,
    label: 'Studying',
    badge: 'warning' as const,
    dot: 'bg-violet-500',
    active: 'bg-violet-500 text-white shadow-sm shadow-violet-500/25',
    labelTone: 'text-violet-600 dark:text-violet-400',
  },
  NOT_STARTED: {
    icon: Circle,
    label: 'Not started',
    badge: 'outline' as const,
    dot: 'bg-muted-foreground/40',
    active: 'bg-secondary text-secondary-foreground shadow-sm ring-1 ring-border',
    labelTone: 'text-muted-foreground',
  },
};

const SUBJECT_ACCENTS = [
  'from-blue-500 to-indigo-500',
  'from-violet-500 to-purple-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-sky-500',
];

const CLASS_TONES: Record<number, { badge: string; soft: string; ring: string }> = {
  9: {
    badge: 'from-sky-500 to-blue-600',
    soft: 'from-sky-500/15 to-blue-500/5',
    ring: 'stroke-sky-500',
  },
  10: {
    badge: 'from-violet-500 to-indigo-600',
    soft: 'from-violet-500/15 to-indigo-500/5',
    ring: 'stroke-violet-500',
  },
  11: {
    badge: 'from-emerald-500 to-teal-600',
    soft: 'from-emerald-500/15 to-teal-500/5',
    ring: 'stroke-emerald-500',
  },
  12: {
    badge: 'from-amber-500 to-orange-600',
    soft: 'from-amber-500/15 to-orange-500/5',
    ring: 'stroke-amber-500',
  },
};

function classTone(level: number) {
  return CLASS_TONES[level] ?? {
    badge: 'from-primary to-violet-600',
    soft: 'from-primary/15 to-violet-500/5',
    ring: 'stroke-primary',
  };
}

function ProgressRing({ percent, className }: { percent: number; className?: string }) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums leading-none">{percent}%</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Done</span>
      </div>
    </div>
  );
}

function calcProgress(subjects: SyllabusSubject[]) {
  const chapters = subjects.flatMap((s) => s.chapters);
  if (!chapters.length) return { percent: 0, studied: 0, total: 0, completed: 0 };
  const completed = chapters.filter((c) => c.status === 'COMPLETED').length;
  const studied = chapters.filter((c) => c.status === 'COMPLETED' || c.status === 'IN_PROGRESS').length;
  return {
    percent: Math.round((completed / chapters.length) * 100),
    studied,
    total: chapters.length,
    completed,
  };
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default function BatchesPage() {
  const { accessToken } = useRequireAuth(true);
  const { can } = usePermissions();
  const { user } = useAuthStore();
  const teacherPortal = isTeacherOnly(normalizeRoles(user?.roles));
  const canManage = can(Permission.BATCH_MANAGE);
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('syllabus');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<BatchForm>({ name: '', academicYear: '2025-26', academicClassId: '' });
  const [editForm, setEditForm] = useState<BatchForm>({ name: '', academicYear: '', academicClassId: '' });
  const [enrollCandidateId, setEnrollCandidateId] = useState('');
  const [enrollRoll, setEnrollRoll] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<Batch[]>,
    enabled: !!accessToken,
  });

  const { data: classes } = useQuery({
    queryKey: ['curriculum-classes'],
    queryFn: () => curriculumApi.getClasses(accessToken!) as Promise<{ id: string; level: number; name: string }[]>,
    enabled: !!accessToken,
  });

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['syllabus-progress', selectedBatch],
    queryFn: () => batchesApi.getSyllabusProgress(accessToken!, selectedBatch!) as Promise<SyllabusSubject[]>,
    enabled: !!accessToken && !!selectedBatch,
    refetchInterval: 5000,
  });

  const { data: batchDetail } = useQuery({
    queryKey: ['batch-detail', selectedBatch],
    queryFn: () => batchesApi.get(accessToken!, selectedBatch!) as Promise<{
      name: string;
      academicYear: string;
      academicClass: { id: string; name: string; level: number; subjects?: { id: string; name: string }[] };
      enrollments: {
        id: string;
        rollNumber?: string;
        candidate: { id: string; registrationNumber: string; user: { firstName: string; lastName: string } };
      }[];
    }>,
    enabled: !!accessToken && !!selectedBatch,
  });

  const { data: candidatesData } = useQuery({
    queryKey: ['candidates-enroll'],
    queryFn: () => candidatesApi.list(accessToken!, 1, ''),
    enabled: !!accessToken && !!selectedBatch && activeTab === 'students',
  });

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches ?? [];
    return (batches ?? []).filter(
      (b) =>
        b.name.toLowerCase().includes(q)
        || b.academicClass.name.toLowerCase().includes(q)
        || b.academicYear.includes(q),
    );
  }, [batches, search]);

  const selectedBatchMeta = (batches ?? []).find((b) => b.id === selectedBatch);
  const progressStats = useMemo(() => calcProgress(progress ?? []), [progress]);

  const activeSubject = useMemo(() => {
    const subjects = progress ?? [];
    if (!subjects.length) return null;
    return subjects.find((s) => s.subject.id === selectedSubjectId) ?? subjects[0];
  }, [progress, selectedSubjectId]);

  useEffect(() => {
    if (!selectedBatch && batches?.length) {
      setSelectedBatch(batches[0].id);
    }
  }, [batches, selectedBatch]);

  useEffect(() => {
    if (progress?.length && !selectedSubjectId) {
      setSelectedSubjectId(progress[0].subject.id);
    }
  }, [progress, selectedSubjectId]);

  useEffect(() => {
    setSelectedSubjectId(null);
  }, [selectedBatch]);

  const totalStudents = useMemo(
    () => (batches ?? []).reduce((sum, b) => sum + b._count.enrollments, 0),
    [batches],
  );

  const enrollMutation = useMutation({
    mutationFn: () => batchesApi.enroll(accessToken!, selectedBatch!, {
      candidateId: enrollCandidateId,
      rollNumber: enrollRoll || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-detail', selectedBatch] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setEnrollCandidateId('');
      setEnrollRoll('');
      toast({ title: 'Student added to batch' });
    },
    onError: (e: Error) => toast({ title: 'Could not enroll', description: e.message, variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: () => batchesApi.create(accessToken!, form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowCreate(false);
      setForm({ name: '', academicYear: '2025-26', academicClassId: '' });
      const created = data as { id?: string };
      if (created?.id) setSelectedBatch(created.id);
      toast({ title: 'Batch created', description: 'Add students and mark studied chapters.' });
    },
    onError: (e: Error) => toast({ title: 'Could not create batch', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: () => batchesApi.update(accessToken!, selectedBatch!, editForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batch-detail', selectedBatch] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setShowEdit(false);
      toast({ title: 'Batch updated' });
    },
    onError: (e: Error) => toast({ title: 'Could not update batch', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => batchesApi.remove(accessToken!, selectedBatch!),
    onSuccess: (data) => {
      const result = data as { name?: string; studentsUnassigned?: number };
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['batch-detail'] });
      setShowDelete(false);
      setSelectedBatch(null);
      toast({
        title: 'Batch deleted',
        description: result.studentsUnassigned
          ? `${result.studentsUnassigned} student(s) are now unassigned.`
          : undefined,
        variant: 'success',
      });
    },
    onError: (e: Error) => toast({ title: 'Could not delete batch', description: e.message, variant: 'destructive' }),
  });

  const updateProgress = useMutation({
    mutationFn: ({ chapterId, status }: { chapterId: string; status: string }) =>
      batchesApi.updateSyllabusProgress(accessToken!, selectedBatch!, { chapterId, status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['syllabus-progress', selectedBatch] }),
  });

  const enrolledIds = new Set((batchDetail?.enrollments ?? []).map((e) => e.candidate.id));
  const availableCandidates = ((candidatesData?.items ?? []) as {
    id: string;
    registrationNumber: string;
    user: { firstName: string; lastName: string };
  }[]).filter((c) => !enrolledIds.has(c.id));

  function openEditDialog() {
    const meta = selectedBatchMeta;
    const detail = batchDetail;
    if (!meta) return;
    const classId = detail?.academicClass.id
      ?? classes?.find((c) => c.level === meta.academicClass.level)?.id
      ?? '';
    setEditForm({
      name: detail?.name ?? meta.name,
      academicYear: detail?.academicYear ?? meta.academicYear,
      academicClassId: classId,
    });
    setShowEdit(true);
  }

  return (
    <div className="space-y-8">
      <div className="hero-banner">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="normal-case tracking-normal">
              {teacherPortal ? 'Teacher · Assigned classes' : 'NCERT · Classes 9–12'}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {teacherPortal ? (
                <>Topic <span className="gradient-text">Progress</span></>
              ) : (
                <>Classes <span className="gradient-text">&amp; Batches</span></>
              )}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {teacherPortal
                ? 'Mark chapter progress for your assigned subjects. Topics come from NCERT books your admin uploaded.'
                : 'Group students by class, mark chapter progress from uploaded books, and power AI class tests from studied syllabus only.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {canManage && (
                <Button onClick={() => setShowCreate(true)} className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  New batch
                </Button>
              )}
              {can(Permission.MATERIAL_READ) && (
                <Button variant="outline" asChild>
                  <Link href="/dashboard/materials">
                    <Upload className="mr-2 h-4 w-4" /> Upload books
                  </Link>
                </Button>
              )}
              {can(Permission.CURRICULUM_READ) && !teacherPortal && (
                <Button variant="ghost" asChild>
                  <Link href="/dashboard/syllabus">
                    <BookOpen className="mr-2 h-4 w-4" /> View syllabus
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              { label: 'Batches', value: batches?.length ?? 0, icon: School, tone: 'bg-blue-500/10 text-blue-600' },
              { label: 'Students', value: totalStudents, icon: Users, tone: 'bg-emerald-500/10 text-emerald-600' },
              {
                label: 'Classes',
                value: new Set((batches ?? []).map((b) => b.academicClass.level)).size || 0,
                icon: GraduationCap,
                tone: 'bg-violet-500/10 text-violet-600',
              },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-center shadow-sm backdrop-blur-sm"
              >
                <div className={cn('mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl', tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,360px)_1fr]">
        {/* Batch list */}
        <Card className="surface-card h-fit overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-violet-500 to-indigo-400" />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <School className="h-4 w-4" />
                </div>
                Your batches
              </CardTitle>
              <Badge variant="secondary" className="normal-case tracking-normal">
                {filteredBatches.length}
              </Badge>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search class or batch…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3 pt-0">
            {isLoading ? (
              <TableSkeleton rows={4} />
            ) : filteredBatches.length === 0 ? (
              <div className="px-2 py-6">
                <EmptyState
                  icon={School}
                  title={search ? 'No batches match' : 'No batches yet'}
                  description={search ? 'Try a different search.' : 'Create a class batch to enroll students and track syllabus.'}
                />
                {canManage && !search && (
                  <div className="flex justify-center pb-2">
                    <Button size="sm" onClick={() => setShowCreate(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Create batch
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredBatches.map((batch) => {
                const isActive = selectedBatch === batch.id;
                const tone = classTone(batch.academicClass.level);
                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => setSelectedBatch(batch.id)}
                    className={cn(
                      'group w-full rounded-2xl border p-4 text-left transition-all duration-200',
                      'hover:-translate-y-0.5 hover:shadow-md',
                      isActive
                        ? 'border-primary/40 bg-gradient-to-br from-primary/[0.08] to-violet-500/[0.04] shadow-md ring-1 ring-primary/20'
                        : 'border-border/50 bg-card hover:border-primary/25',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm',
                        tone.badge,
                      )}>
                        <span className="text-sm font-bold">{batch.academicClass.level}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-bold">{batch.name}</p>
                          {isActive && <ChevronRight className="h-4 w-4 shrink-0 text-primary" />}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {batch.academicClass.name}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className={cn(
                            'inline-flex rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[11px] font-semibold',
                            tone.soft,
                          )}>
                            {batch.academicYear}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {batch._count.enrollments} students
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Batch detail */}
        <div className="min-w-0 space-y-4">
          {!selectedBatch ? (
            <Card className="surface-card overflow-hidden">
              <div className="hero-banner m-0 rounded-none border-0">
                <EmptyState
                  icon={BookOpen}
                  title="Select a batch"
                  description="Choose a class batch from the left to manage students and mark NCERT chapter progress."
                />
              </div>
            </Card>
          ) : (
            <>
              {/* Batch header */}
              <Card className="surface-card overflow-hidden border-primary/15">
                <div className={cn(
                  'h-1.5 bg-gradient-to-r',
                  classTone(batchDetail?.academicClass.level ?? selectedBatchMeta?.academicClass.level ?? 10).badge,
                )} />
                <CardContent className="relative p-0">
                  <div className={cn(
                    'absolute inset-0 bg-gradient-to-br opacity-70',
                    classTone(batchDetail?.academicClass.level ?? selectedBatchMeta?.academicClass.level ?? 10).soft,
                  )} />
                  <div className="relative space-y-5 p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-bold text-white shadow-lg',
                          classTone(batchDetail?.academicClass.level ?? selectedBatchMeta?.academicClass.level ?? 10).badge,
                        )}>
                          {batchDetail?.academicClass.level ?? selectedBatchMeta?.academicClass.level}
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            Active batch
                          </p>
                          <h2 className="mt-1 text-2xl font-bold tracking-tight">
                            {batchDetail?.name ?? selectedBatchMeta?.name}
                          </h2>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="normal-case tracking-normal">
                              {batchDetail?.academicClass.name ?? selectedBatchMeta?.academicClass.name}
                            </Badge>
                            <Badge variant="outline" className="normal-case tracking-normal">
                              {batchDetail?.academicYear ?? selectedBatchMeta?.academicYear}
                            </Badge>
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              {batchDetail?.enrollments?.length ?? selectedBatchMeta?._count.enrollments ?? 0} enrolled
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
                          <ProgressRing percent={progressStats.percent} />
                          <div className="pr-2 space-y-2">
                            <div>
                              <p className="text-xl font-bold tabular-nums leading-none">{progressStats.studied}</p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Studied</p>
                            </div>
                            <div>
                              <p className="text-xl font-bold tabular-nums leading-none">{progressStats.completed}</p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Completed</p>
                            </div>
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="shrink-0 bg-card shadow-sm"
                              title="Edit batch"
                              onClick={openEditDialog}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="shrink-0 bg-card text-destructive shadow-sm hover:text-destructive"
                              title="Delete batch"
                              onClick={() => setShowDelete(true)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>Overall syllabus coverage</span>
                        <span>{progressStats.completed} / {progressStats.total} chapters</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-card/80 shadow-inner">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-violet-500 to-emerald-500 transition-all duration-700"
                          style={{ width: `${progressStats.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-card/75 px-4 py-3.5 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p>
                        Chapters come from <strong className="font-semibold text-foreground">uploaded NCERT books</strong>.
                        Mark <strong className="font-semibold text-foreground">Studying</strong> or{' '}
                        <strong className="font-semibold text-foreground">Done</strong> so AI class tests only use covered chapters.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 shadow-sm">
                {([
                  { id: 'syllabus' as const, label: 'Syllabus progress', icon: BookOpen },
                  { id: 'students' as const, label: `Students (${batchDetail?.enrollments?.length ?? selectedBatchMeta?._count.enrollments ?? 0})`, icon: Users },
                ]).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                      activeTab === id
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'students' && (
                <Card className="surface-card overflow-hidden">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <UserPlus className="h-4 w-4 text-primary" />
                      Enroll students
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Add students from your institute roster to this class batch.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-5">
                    {canManage ? (
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                          <select
                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                            value={enrollCandidateId}
                            onChange={(e) => setEnrollCandidateId(e.target.value)}
                          >
                            <option value="">Choose a student…</option>
                            {availableCandidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.user.firstName} {c.user.lastName} — {c.registrationNumber}
                              </option>
                            ))}
                          </select>
                          <Input
                            placeholder="Roll no."
                            className="sm:w-28"
                            value={enrollRoll}
                            onChange={(e) => setEnrollRoll(e.target.value)}
                          />
                          <Button
                            disabled={!enrollCandidateId || enrollMutation.isPending}
                            onClick={() => enrollMutation.mutate()}
                          >
                            {enrollMutation.isPending ? 'Adding…' : 'Add'}
                          </Button>
                        </div>
                        {availableCandidates.length === 0 && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            All students are already in this batch, or create new ones on{' '}
                            <Link href="/dashboard/candidates" className="font-semibold text-primary hover:underline">Students</Link>.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">You can view enrolled students but cannot add or remove them.</p>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Enrolled roster
                        </p>
                        <Badge variant="outline" className="normal-case tracking-normal">
                          {batchDetail?.enrollments?.length ?? 0} student{(batchDetail?.enrollments?.length ?? 0) === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      {(batchDetail?.enrollments ?? []).length === 0 ? (
                        <div className="rounded-xl border border-dashed py-10">
                          <EmptyState
                            icon={Users}
                            title="No students in this batch"
                            description="Choose a student above to enroll them in this class batch."
                          />
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
                          {(batchDetail?.enrollments ?? []).map((e) => (
                            <div key={e.id} className="flex items-center gap-3 bg-card px-4 py-3.5 transition-colors hover:bg-muted/30">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-violet-500/10 text-xs font-bold text-primary">
                                {initials(e.candidate.user.firstName, e.candidate.user.lastName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">
                                  {e.candidate.user.firstName} {e.candidate.user.lastName}
                                </p>
                                <p className="font-mono text-xs text-muted-foreground">{e.candidate.registrationNumber}</p>
                              </div>
                              {e.rollNumber && (
                                <Badge variant="secondary" className="normal-case tracking-normal">
                                  Roll {e.rollNumber}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'syllabus' && (
                <div className="space-y-4">
                  {progressLoading ? (
                    <TableSkeleton rows={6} />
                  ) : !(progress ?? []).length ? (
                    <Card className="surface-card">
                      <EmptyState
                        icon={BookOpen}
                        title="No uploaded books for this class yet"
                        description="Upload NCERT PDFs for this class on NCERT Books. Chapters appear here after indexing."
                      />
                      <div className="flex justify-center gap-3 pb-8">
                        <Button asChild>
                          <Link href="/dashboard/materials">
                            <Upload className="mr-2 h-4 w-4" /> Upload NCERT books
                          </Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link href="/dashboard/syllabus">View syllabus</Link>
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {(progress ?? []).map((sp) => {
                          const subjProgress = calcProgress([sp]);
                          const isActive = activeSubject?.subject.id === sp.subject.id;
                          return (
                            <button
                              key={sp.subject.id}
                              type="button"
                              onClick={() => setSelectedSubjectId(sp.subject.id)}
                              className={cn(
                                'rounded-full border px-4 py-2 text-sm font-semibold transition-all',
                                isActive
                                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                  : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/40',
                              )}
                            >
                              {sp.subject.name}
                              <span className={cn('ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold', isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                                {subjProgress.percent}%
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {activeSubject && (
                        <Card className="surface-card overflow-hidden">
                          <div className={cn(
                            'h-1 bg-gradient-to-r',
                            SUBJECT_ACCENTS[(progress ?? []).findIndex((s) => s.subject.id === activeSubject.subject.id) % SUBJECT_ACCENTS.length],
                          )} />
                          <CardHeader className="border-b border-border/60 pb-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <CardTitle className="text-lg">{activeSubject.subject.name}</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Mark each chapter so AI tests only use what this batch has studied.
                                </p>
                              </div>
                              <Badge variant="outline" className="normal-case tracking-normal shrink-0">
                                {activeSubject.chapters.filter((c) => c.status === 'COMPLETED').length}
                                /{activeSubject.chapters.length} done
                              </Badge>
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all"
                                style={{
                                  width: `${calcProgress([activeSubject]).percent}%`,
                                }}
                              />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-1.5 p-3 sm:p-4">
                            {activeSubject.chapters.map((ch) => {
                              const st = STATUS_CONFIG[ch.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NOT_STARTED;
                              return (
                                <div
                                  key={ch.id}
                                  className="rounded-xl border border-border/40 bg-muted/15 px-3.5 py-3 transition-colors hover:border-border/70 hover:bg-muted/35"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background', st.dot)} />
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold">
                                          <span className="mr-1.5 inline-flex rounded-md bg-background px-1.5 py-0.5 font-mono text-[11px] text-primary shadow-sm">
                                            Ch.{ch.number}
                                          </span>
                                          {ch.title}
                                        </p>
                                        <p className={cn('mt-0.5 text-[11px] font-medium', st.labelTone)}>{st.label}</p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-0.5 rounded-lg border border-border/60 bg-card p-0.5 shadow-sm sm:ml-4">
                                      {(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => {
                                        const cfg = STATUS_CONFIG[s];
                                        const active = ch.status === s;
                                        return (
                                          <button
                                            key={s}
                                            type="button"
                                            disabled={updateProgress.isPending}
                                            onClick={() => updateProgress.mutate({ chapterId: ch.id, status: s })}
                                            className={cn(
                                              'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all',
                                              active ? cfg.active : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                            )}
                                          >
                                            {cfg.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new batch</DialogTitle>
            <DialogDescription>
              A batch groups students in the same class for tests and syllabus tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Batch name</Label>
              <Input
                placeholder="e.g. Morning Batch, Section A"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.academicClassId}
                onChange={(e) => setForm({ ...form, academicClassId: e.target.value })}
              >
                <option value="">Select NCERT class</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>Class {c.level} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Academic year</Label>
              <Input
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                placeholder="2025-26"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!form.name || !form.academicClassId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit batch</DialogTitle>
            <DialogDescription>
              Update the batch name, class, or academic year. The same name can be used in different classes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Batch name</Label>
              <Input
                placeholder="e.g. Morning Batch, Section A"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editForm.academicClassId}
                onChange={(e) => setEditForm({ ...editForm, academicClassId: e.target.value })}
              >
                <option value="">Select NCERT class</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>Class {c.level} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Academic year</Label>
              <Input
                value={editForm.academicYear}
                onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })}
                placeholder="2025-26"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button
              disabled={!editForm.name || !editForm.academicClassId || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete batch?</DialogTitle>
            <DialogDescription>
              {selectedBatchMeta && (
                <>
                  <span className="font-medium text-foreground">
                    {selectedBatchMeta.name}
                  </span>{' '}
                  ({selectedBatchMeta.academicClass.name}, {selectedBatchMeta.academicYear}) will be permanently removed.
                  {selectedBatchMeta._count.enrollments > 0 && (
                    <>
                      {' '}
                      <strong>{selectedBatchMeta._count.enrollments}</strong> enrolled student(s) will become unassigned.
                    </>
                  )}
                  {' '}Syllabus progress for this batch will also be deleted. Linked AI test configs are kept but no longer tied to this batch. Teacher class assignments for this batch are removed.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !selectedBatch}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
