'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/data-table';
import { batchesApi, candidatesApi, learningApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  BookOpen, CheckCircle2, Circle, Clock, GraduationCap, TrendingDown, Users, BarChart3,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/layout/stat-card';
import { cn } from '@/lib/utils';

type AssignedSubject = { id: string; name: string; code?: string };

type TeacherBatch = {
  id: string;
  name: string;
  academicYear: string;
  academicClass: { id: string; name: string; level: number };
  _count: { enrollments: number };
  teacherAssignments?: { subject: AssignedSubject }[];
};

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

const STATUS_CONFIG = {
  COMPLETED: {
    icon: CheckCircle2,
    label: 'Done',
    active: 'bg-primary text-primary-foreground shadow-sm shadow-primary/25',
  },
  IN_PROGRESS: {
    icon: Clock,
    label: 'Studying',
    active: 'bg-violet-500 text-white shadow-sm shadow-violet-500/25',
  },
  NOT_STARTED: {
    icon: Circle,
    label: 'Not started',
    active: 'bg-secondary text-secondary-foreground shadow-sm ring-1 ring-border',
  },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

export default function TeacherPage() {
  const { accessToken } = useRequireAuth(true);
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<TeacherBatch[]>,
    enabled: !!accessToken,
  });

  const activeBatch = selectedBatch || batches?.[0]?.id;
  const activeBatchMeta = (batches ?? []).find((b) => b.id === activeBatch);
  const assignedSubjects = activeBatchMeta?.teacherAssignments?.map((a) => a.subject) ?? [];

  useEffect(() => {
    if (!selectedBatch && batches?.length) setSelectedBatch(batches[0].id);
  }, [batches, selectedBatch]);

  useEffect(() => {
    if (assignedSubjects.length && !assignedSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(assignedSubjects[0].id);
    }
  }, [assignedSubjects, selectedSubjectId]);

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['syllabus-progress', activeBatch, selectedSubjectId],
    queryFn: () =>
      batchesApi.getSyllabusProgress(accessToken!, activeBatch!, selectedSubjectId || undefined) as Promise<SyllabusSubject[]>,
    enabled: !!accessToken && !!activeBatch,
  });

  const activeSubject = useMemo(() => {
    const subjects = progress ?? [];
    if (!subjects.length) return null;
    return subjects.find((s) => s.subject.id === selectedSubjectId) ?? subjects[0];
  }, [progress, selectedSubjectId]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['teacher-analytics', activeBatch, selectedSubjectId],
    queryFn: () => learningApi.teacherAnalytics(accessToken!, activeBatch!, selectedSubjectId || undefined) as Promise<{
      batch: { name: string; class: string };
      studentCount: number;
      batchAverage: number;
      chapterPerformance: { topicId: string; topic: string; avgAccuracy: number; studentCount: number }[];
      weakTopics: { topic: string; avgAccuracy: number }[];
    }>,
    enabled: !!accessToken && !!activeBatch,
  });

  const { data: studentsData } = useQuery({
    queryKey: ['teacher-students', activeBatch],
    queryFn: () => candidatesApi.list(accessToken!, 1, '', 50, { batchId: activeBatch }),
    enabled: !!accessToken && !!activeBatch,
  });

  const students = (studentsData as { items?: {
    id: string;
    registrationNumber: string;
    user: { firstName: string; lastName: string; email: string };
  }[] })?.items ?? [];

  const updateProgress = useMutation({
    mutationFn: (body: { chapterId?: string; topicId?: string; status: string }) =>
      batchesApi.updateSyllabusProgress(accessToken!, activeBatch!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus-progress', activeBatch] });
    },
  });

  const chapterStats = useMemo(() => {
    const chapters = activeSubject?.chapters ?? [];
    if (!chapters.length) return { percent: 0, completed: 0, total: 0 };
    const completed = chapters.filter((c) => c.status === 'COMPLETED').length;
    return {
      percent: Math.round((completed / chapters.length) * 100),
      completed,
      total: chapters.length,
    };
  }, [activeSubject]);

  if (batchesLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Classes" highlight="Classes" description="Your assigned subjects and topic progress" />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (!batches?.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Classes"
          highlight="Classes"
          description="Your assigned subjects and topic progress"
          badge="Teacher"
        />
        <Card>
          <CardContent className="p-10">
            <EmptyState
              icon={GraduationCap}
              title="No classes assigned yet"
              description="Ask your institute admin to assign you to a batch and subject. Once assigned, you'll see extracted topics from uploaded NCERT books here."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        highlight="Classes"
        description="View assigned subjects, mark chapter progress, and manage students in your classes"
        badge="Teacher"
      />

      <div className="flex flex-wrap gap-2">
        {(batches ?? []).map((b) => (
          <Badge
            key={b.id}
            variant={activeBatch === b.id ? 'default' : 'outline'}
            className="cursor-pointer px-4 py-2"
            onClick={() => {
              setSelectedBatch(b.id);
              setSelectedSubjectId('');
            }}
          >
            {b.name} · {b.academicClass.name}
          </Badge>
        ))}
      </div>

      {assignedSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assignedSubjects.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={selectedSubjectId === s.id ? 'default' : 'outline'}
              onClick={() => setSelectedSubjectId(s.id)}
            >
              {s.name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard title="Students" value={analytics?.studentCount ?? students.length} icon={Users} />
        <StatCard title="Chapters done" value={`${chapterStats.completed}/${chapterStats.total}`} icon={BookOpen} />
        <StatCard title="Progress" value={`${chapterStats.percent}%`} icon={BarChart3} />
        <StatCard title="Weak topics" value={analytics?.weakTopics?.length ?? 0} icon={TrendingDown} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5" />
              Topic progress
              {activeSubject && (
                <span className="text-muted-foreground font-normal">· {activeSubject.subject.name}</span>
              )}
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/batches">Open full view</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {progressLoading ? (
              <TableSkeleton rows={3} />
            ) : activeSubject?.chapters?.length ? (
              activeSubject.chapters.map((ch) => {
                const status = (ch.status in STATUS_CONFIG ? ch.status : 'NOT_STARTED') as StatusKey;
                return (
                  <div key={ch.id} className="rounded-xl border border-border/60 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Ch {ch.number}. {ch.title}
                        </p>
                        {!!ch.topics?.length && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ch.topics.length} topics from uploaded material
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        const Icon = cfg.icon;
                        const isActive = status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={updateProgress.isPending}
                            onClick={() => updateProgress.mutate({ chapterId: ch.id, status: s })}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                              isActive ? cfg.active : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                    {!!ch.topics?.length && (
                      <ul className="mt-1 space-y-1 border-t border-border/50 pt-2">
                        {ch.topics.slice(0, 6).map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{t.title}</span>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {(t.status ?? 'NOT_STARTED').replace('_', ' ').toLowerCase()}
                            </Badge>
                          </li>
                        ))}
                        {ch.topics.length > 6 && (
                          <li className="text-[11px] text-muted-foreground">+{ch.topics.length - 6} more topics</li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No topics yet"
                description="Once your admin uploads NCERT books and they're indexed, chapters and topics for your subject will appear here."
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                My students
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {students.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.user.firstName} {s.user.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{s.registrationNumber}</p>
                  </div>
                </div>
              ))}
              {!students.length && (
                <p className="py-4 text-center text-sm text-muted-foreground">No students in this class yet</p>
              )}
              {students.length > 0 && (
                <Button asChild variant="outline" size="sm" className="w-full mt-2">
                  <Link href="/dashboard/candidates">View all students</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <TrendingDown className="h-5 w-5" />
                Weak areas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analyticsLoading ? (
                <TableSkeleton rows={2} />
              ) : analytics?.weakTopics?.length ? (
                analytics.weakTopics.map((w, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                    <span className="text-sm font-medium truncate pr-2">{w.topic}</span>
                    <Badge variant="destructive">{w.avgAccuracy.toFixed(0)}%</Badge>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No weak areas identified yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
