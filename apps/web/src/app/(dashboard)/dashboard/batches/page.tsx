'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
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
  GraduationCap, BookOpen, UserPlus, Sparkles, ChevronRight, Trash2, Pencil,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
    dot: 'bg-emerald-500',
  },
  IN_PROGRESS: {
    icon: Clock,
    label: 'Studying',
    badge: 'warning' as const,
    dot: 'bg-amber-500',
  },
  NOT_STARTED: {
    icon: Circle,
    label: 'Not started',
    badge: 'outline' as const,
    dot: 'bg-muted-foreground/40',
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
      academicClass: { id: string; name: string; level: number };
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
      <PageHeader
        title="Classes & Batches"
        description="Organize students by class, track syllabus progress from uploaded books, and power AI tests from studied chapters."
        badge="From uploads"
      >
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            New batch
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Active batches" value={batches?.length ?? 0} icon={School} accent="blue" />
        <StatCard title="Students enrolled" value={totalStudents} icon={Users} accent="green" />
        <StatCard
          title="Classes covered"
          value={new Set((batches ?? []).map((b) => b.academicClass.level)).size || 0}
          icon={GraduationCap}
          accent="violet"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
        {/* Batch list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search batches…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <TableSkeleton rows={4} />
          ) : filteredBatches.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <School className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">No batches yet</p>
                <p className="text-sm text-muted-foreground">Create your first class group to get started.</p>
                {canManage && (
                  <Button size="sm" onClick={() => setShowCreate(true)}>Create batch</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredBatches.map((batch) => {
                const isActive = selectedBatch === batch.id;
                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => setSelectedBatch(batch.id)}
                    className={cn(
                      'group w-full rounded-xl border bg-card p-4 text-left transition-all duration-200',
                      'hover:border-primary/30 hover:shadow-md',
                      isActive && 'border-primary/50 bg-primary/[0.03] shadow-md ring-1 ring-primary/20',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                      )}>
                        <span className="text-sm font-bold">{batch.academicClass.level}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{batch.name}</p>
                          {isActive && <ChevronRight className="h-4 w-4 shrink-0 text-primary" />}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {batch.academicClass.name}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="normal-case tracking-normal">
                            {batch.academicYear}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {batch._count.enrollments} students
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Batch detail */}
        <div className="min-w-0 space-y-4">
          {!selectedBatch ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium text-muted-foreground">Select a batch to manage</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Batch header */}
              <Card className="surface-card overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-violet-500" />
                <CardContent className="p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight">
                          {batchDetail?.name ?? selectedBatchMeta?.name}
                        </h2>
                        <Badge variant="outline" className="normal-case tracking-normal">
                          {batchDetail?.academicClass.name ?? selectedBatchMeta?.academicClass.name}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Academic year {batchDetail?.academicYear ?? selectedBatchMeta?.academicYear}
                        {' · '}
                        {batchDetail?.enrollments?.length ?? selectedBatchMeta?._count.enrollments ?? 0} students
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                        <div className="text-center">
                          <p className="text-2xl font-bold tabular-nums text-primary">{progressStats.percent}%</p>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Syllabus done</p>
                        </div>
                        <div className="h-10 w-px bg-border" />
                        <div className="text-center">
                          <p className="text-2xl font-bold tabular-nums">{progressStats.studied}</p>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Studied ch.</p>
                        </div>
                      </div>
                      {canManage && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            title="Edit batch"
                            onClick={openEditDialog}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 text-destructive hover:text-destructive"
                            title="Delete batch"
                            onClick={() => setShowDelete(true)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>Overall progress</span>
                      <span>{progressStats.completed} / {progressStats.total} chapters completed</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                        style={{ width: `${progressStats.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Only <strong className="font-medium text-foreground">uploaded chapters</strong> appear here.
                      Mark <strong className="font-medium text-foreground">Studying</strong> or{' '}
                      <strong className="font-medium text-foreground">Done</strong> to include them in AI tests.
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 rounded-xl border bg-muted/40 p-1">
                {([
                  { id: 'syllabus' as const, label: 'Syllabus progress', icon: BookOpen },
                  { id: 'students' as const, label: 'Students', icon: Users },
                ]).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                      activeTab === id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'students' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <UserPlus className="h-4 w-4 text-primary" />
                      Enroll students
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {canManage ? (
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                          Add
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">You can view enrolled students but cannot add or remove them.</p>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Enrolled ({batchDetail?.enrollments?.length ?? 0})
                      </p>
                      {(batchDetail?.enrollments ?? []).length === 0 ? (
                        <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                          No students in this batch yet. Add students from the dropdown above.
                        </div>
                      ) : (
                        <div className="divide-y rounded-xl border">
                          {(batchDetail?.enrollments ?? []).map((e) => (
                            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {initials(e.candidate.user.firstName, e.candidate.user.lastName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {e.candidate.user.firstName} {e.candidate.user.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{e.candidate.registrationNumber}</p>
                              </div>
                              {e.rollNumber && (
                                <Badge variant="outline" className="normal-case tracking-normal">
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
                    <Card className="border-dashed">
                      <CardContent className="space-y-2 py-12 text-center">
                        <p className="font-medium text-muted-foreground">No uploaded books for this class yet</p>
                        <p className="text-sm text-muted-foreground">
                          Upload a book on Books &amp; Notes for this class and subject.
                          Chapters are extracted from your PDF and appear here after indexing.
                        </p>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/dashboard/materials">Go to Books &amp; Notes</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Subject pills */}
                      <div className="flex flex-wrap gap-2">
                        {(progress ?? []).map((sp, i) => {
                          const subjProgress = calcProgress([sp]);
                          const isActive = activeSubject?.subject.id === sp.subject.id;
                          return (
                            <button
                              key={sp.subject.id}
                              type="button"
                              onClick={() => setSelectedSubjectId(sp.subject.id)}
                              className={cn(
                                'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                                isActive
                                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                  : 'bg-card hover:border-primary/40 hover:bg-muted/50',
                              )}
                            >
                              {sp.subject.name}
                              <span className={cn('ml-2 text-xs', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                {subjProgress.percent}%
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {activeSubject && (
                        <Card className="overflow-hidden">
                          <div className={cn(
                            'h-1 bg-gradient-to-r',
                            SUBJECT_ACCENTS[(progress ?? []).findIndex((s) => s.subject.id === activeSubject.subject.id) % SUBJECT_ACCENTS.length],
                          )} />
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-4">
                              <CardTitle className="text-lg">{activeSubject.subject.name}</CardTitle>
                              <Badge variant="outline" className="normal-case tracking-normal">
                                {activeSubject.chapters.filter((c) => c.status === 'COMPLETED').length}
                                /{activeSubject.chapters.length} done
                              </Badge>
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{
                                  width: `${calcProgress([activeSubject]).percent}%`,
                                }}
                              />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-1 pb-4">
                            {activeSubject.chapters.map((ch) => {
                              const st = STATUS_CONFIG[ch.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NOT_STARTED;
                              return (
                                <div key={ch.id} className="rounded-xl px-3 py-2.5 hover:bg-muted/40">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span className={cn('h-2 w-2 shrink-0 rounded-full', st.dot)} />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium">
                                          <span className="text-muted-foreground">Ch. {ch.number}</span>
                                          {' · '}
                                          {ch.title}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-1 rounded-lg border bg-muted/30 p-0.5 sm:ml-4">
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
                                              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                                              active
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground',
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
                  {' '}Syllabus progress and teacher assignments for this batch will also be deleted. Linked AI test configs are kept but no longer tied to this batch.
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
