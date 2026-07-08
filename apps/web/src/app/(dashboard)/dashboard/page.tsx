'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Users, Sparkles, ArrowRight, CheckCircle2, BookOpen,
  GraduationCap, ClipboardList, Award, Calendar, TrendingUp,
  ExternalLink, Circle, ChevronRight, School, FileText,
} from 'lucide-react';
import { dashboardApi, onboardingApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { normalizeRoles } from '@/lib/roles';
import { Permission } from '@cbt/shared';
import { StatCard } from '@/components/layout/stat-card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatExamDateTime } from '@/lib/exam-dates';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type SetupStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  href: string;
  done: boolean;
  detail: string;
};

type SetupStatus = {
  progress: number;
  completed: number;
  total: number;
  nextStep?: SetupStep;
  steps: SetupStep[];
};

type DashboardData = {
  stats?: {
    totalExams: number;
    publishedExams: number;
    totalCandidates: number;
    totalQuestions: number;
    activeSessions: number;
    violationAlerts: number;
  };
  upcomingExams?: {
    id: string;
    title: string;
    code: string;
    startTime: string;
    endTime: string;
    timezone?: string;
    _count?: { registrations: number };
  }[];
  recentSubmissions?: {
    id: string;
    candidateName: string;
    examTitle: string;
    percentage: number;
    submittedAt: string;
  }[];
};

const workflowSteps = [
  {
    num: 1,
    title: 'Upload books & notes',
    desc: 'Add NCERT PDFs — chapters and topics are extracted automatically',
    href: '/dashboard/materials',
    icon: Upload,
    permission: Permission.MATERIAL_READ,
    keys: ['materials', 'syllabus'] as const,
  },
  {
    num: 2,
    title: 'Set up class & students',
    desc: 'Create batches, enroll students, mark completed chapters',
    href: '/dashboard/batches',
    icon: Users,
    permission: Permission.BATCH_READ,
    keys: ['batch', 'enroll', 'students', 'syllabus-progress'] as const,
  },
  {
    num: 3,
    title: 'Create & assign tests',
    desc: 'AI generates NCERT-aligned questions and publishes to students',
    href: '/dashboard/ai-tests',
    icon: Sparkles,
    permission: Permission.AI_GENERATE_TEST,
    keys: ['ai-test'] as const,
  },
];

const quickActions: {
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  accent: string;
}[] = [
  {
    label: 'Create Test',
    desc: 'AI question builder',
    href: '/dashboard/ai-tests',
    icon: Sparkles,
    permission: Permission.AI_GENERATE_TEST,
    accent: 'from-violet-500/15 to-purple-500/5 text-violet-600',
  },
  {
    label: 'Classes & Batches',
    desc: 'Manage enrollments',
    href: '/dashboard/batches',
    icon: School,
    permission: Permission.BATCH_READ,
    accent: 'from-blue-500/15 to-indigo-500/5 text-blue-600',
  },
  {
    label: 'Books & Notes',
    desc: 'Upload study material',
    href: '/dashboard/materials',
    icon: BookOpen,
    permission: Permission.MATERIAL_READ,
    accent: 'from-emerald-500/15 to-teal-500/5 text-emerald-600',
  },
  {
    label: 'Students',
    desc: 'Add or import learners',
    href: '/dashboard/candidates',
    icon: GraduationCap,
    permission: Permission.CANDIDATE_READ,
    accent: 'from-amber-500/15 to-orange-500/5 text-amber-600',
  },
  {
    label: 'View Results',
    desc: 'Scores & rankings',
    href: '/dashboard/results',
    icon: Award,
    permission: Permission.RESULT_READ,
    accent: 'from-rose-500/15 to-pink-500/5 text-rose-600',
  },
  {
    label: 'All Exams',
    desc: 'Schedule & manage',
    href: '/dashboard/exams',
    icon: ClipboardList,
    permission: Permission.EXAM_READ,
    accent: 'from-cyan-500/15 to-sky-500/5 text-cyan-600',
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function roleSubtitle(roles: string[]) {
  if (roles.includes('TEACHER')) {
    return 'Create NCERT-aligned tests, track class progress, and review student performance — all in one place.';
  }
  if (roles.includes('INSTITUTE_ADMIN') || roles.includes('ORG_ADMIN')) {
    return 'Your institute hub for classes, study material, AI-generated tests, and student results.';
  }
  return 'Run structured assessments for Classes 9–12 with AI-powered question generation from your books.';
}

function stepProgress(keys: readonly string[], doneMap: Map<string, boolean>) {
  const done = keys.filter((k) => doneMap.get(k)).length;
  return { done, total: keys.length, complete: done === keys.length };
}

function parseLeadingCount(detail?: string) {
  const m = detail?.match(/^(\d+)/);
  return m ? Number(m[1]) : 0;
}

export default function DashboardPage() {
  const { accessToken } = useRequireAuth(true);
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const roles = normalizeRoles(user?.roles);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.stats(accessToken!) as Promise<DashboardData>,
    enabled: !!accessToken,
  });

  const { data: setup } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => onboardingApi.setupStatus(accessToken!) as Promise<SetupStatus>,
    enabled: !!accessToken,
  });

  const stats = data?.stats;
  const doneMap = new Map((setup?.steps ?? []).map((s) => [s.id, s.done]));
  const setupComplete = (setup?.progress ?? 0) >= 100;
  const visibleActions = quickActions.filter((a) => can(a.permission));
  const visibleWorkflow = workflowSteps.filter((s) => can(s.permission));
  const greeting = getGreeting();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <TableSkeleton rows={4} cols={2} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="hero-banner">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="normal-case tracking-normal">
                NCERT · Classes 9–12
              </Badge>
              {setup && !setupComplete && (
                <Badge variant="warning" className="normal-case tracking-normal">
                  Setup {setup.progress}% complete
                </Badge>
              )}
              {setupComplete && (
                <Badge variant="success" className="normal-case tracking-normal">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready to teach
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-primary">
                Good {greeting}, {user?.firstName}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Welcome to your{' '}
                <span className="gradient-text">teaching dashboard</span>
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {roleSubtitle(roles)}
              </p>
            </div>
          </div>

          {setup && !setupComplete && (
            <div className="w-full shrink-0 rounded-xl border border-border/60 bg-card/80 p-5 backdrop-blur-sm lg:max-w-sm">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">Getting started</span>
                <span className="tabular-nums text-muted-foreground">
                  {setup.completed}/{setup.total} steps
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500"
                  style={{ width: `${setup.progress}%` }}
                />
              </div>
              {setup.nextStep && (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Up next
                    </p>
                    <p className="mt-1 font-semibold">{setup.nextStep.title}</p>
                    <p className="text-sm text-muted-foreground">{setup.nextStep.detail}</p>
                  </div>
                  <Button size="sm" className="w-full" asChild>
                    <Link href={setup.nextStep.href}>
                      Continue setup <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {setupComplete && visibleActions.length > 0 && (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {visibleActions.slice(0, 2).map((action) => (
                <Button key={action.href} size="sm" asChild>
                  <Link href={action.href}>
                    <action.icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {can(Permission.CANDIDATE_READ) && (
          <StatCard title="Students" value={stats?.totalCandidates ?? 0} icon={GraduationCap} accent="green" />
        )}
        {can(Permission.EXAM_READ) && (
          <StatCard title="Published Tests" value={stats?.publishedExams ?? 0} icon={ClipboardList} accent="violet" />
        )}
        {can(Permission.MATERIAL_READ) && (() => {
          const materialsDetail = setup?.steps.find((s) => s.id === 'materials')?.detail;
          const indexed = parseLeadingCount(materialsDetail);
          const totalMatch = materialsDetail?.match(/\/(\d+)/);
          const total = totalMatch ? Number(totalMatch[1]) : undefined;
          return (
            <StatCard
              title="Indexed Books"
              value={indexed}
              icon={BookOpen}
              accent="blue"
              trend={total !== undefined && total > 0 ? `${total} uploaded` : undefined}
            />
          );
        })()}
        {can(Permission.RESULT_READ) && (
          <StatCard
            title="AI Questions"
            value={stats?.totalQuestions ?? 0}
            icon={Sparkles}
            accent="amber"
            trend={stats?.publishedExams ? `${stats.publishedExams} live test(s)` : undefined}
          />
        )}
      </div>

      {/* Quick actions */}
      {visibleActions.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Quick actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group surface-card flex items-center gap-4 rounded-xl p-4"
                >
                  <div className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
                    action.accent,
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium group-hover:text-primary">{action.label}</p>
                    <p className="text-sm text-muted-foreground">{action.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Teaching workflow */}
        {visibleWorkflow.length > 0 && (
          <section className="lg:col-span-3">
            <div className="mb-4">
              <h2 className="text-base font-semibold">How it works</h2>
              <p className="text-sm text-muted-foreground">
                Three steps from books to live tests for your students
              </p>
            </div>
            <div className="space-y-3">
              {visibleWorkflow.map((step, idx) => {
                const Icon = step.icon;
                const progress = stepProgress(step.keys, doneMap);
                const isLast = idx === visibleWorkflow.length - 1;

                return (
                  <div key={step.num} className="relative">
                    {!isLast && (
                      <div className="absolute left-[27px] top-[60px] hidden h-[calc(100%-12px)] w-px bg-border md:block" />
                    )}
                    <Card className={cn(
                      'surface-card overflow-hidden transition-colors',
                      progress.complete && 'border-emerald-500/30',
                    )}>
                      <CardContent className="flex gap-4 p-5">
                        <div className={cn(
                          'relative z-10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl',
                          progress.complete
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-primary/10 text-primary',
                        )}>
                          {progress.complete ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <>
                              <Icon className="h-5 w-5" />
                              <span className="mt-0.5 text-[10px] font-bold">Step {step.num}</span>
                            </>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold">{step.title}</h3>
                              <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                            </div>
                            {!progress.complete && progress.done > 0 && (
                              <Badge variant="warning" className="normal-case tracking-normal">
                                {progress.done}/{progress.total} done
                              </Badge>
                            )}
                          </div>
                          {!progress.complete && (
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/70 transition-all"
                                style={{ width: `${(progress.done / progress.total) * 100}%` }}
                              />
                            </div>
                          )}
                          <Button
                            variant={progress.complete ? 'outline' : 'default'}
                            size="sm"
                            className="mt-4"
                            asChild
                          >
                            <Link href={step.href}>
                              {progress.complete ? 'Open' : 'Get started'}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Activity sidebar */}
        <aside className="space-y-6 lg:col-span-2">
          {can(Permission.EXAM_READ) && (data?.upcomingExams?.length ?? 0) > 0 && (
            <Card className="surface-card">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Calendar className="h-4 w-4 text-primary" />
                  Upcoming tests
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/60 p-0">
                {data!.upcomingExams!.slice(0, 4).map((exam) => (
                  <Link
                    key={exam.id}
                    href="/dashboard/exams"
                    className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <FileText className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatExamDateTime(exam.startTime, exam.timezone)}
                      </p>
                      {exam._count && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {exam._count.registrations} registered
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {can(Permission.RESULT_READ) && (data?.recentSubmissions?.length ?? 0) > 0 && (
            <Card className="surface-card">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Recent submissions
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/60 p-0">
                {data!.recentSubmissions!.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-700">
                      {Math.round(sub.percentage)}%
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{sub.candidateName}</p>
                      <p className="truncate text-xs text-muted-foreground">{sub.examTitle}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(sub.submittedAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Student portal */}
          <Card className="surface-card overflow-hidden border-primary/15">
            <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Student portal</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Students sign in and take assigned tests from{' '}
                    <strong className="font-medium text-foreground">My Tests</strong>.
                    No setup needed on their side.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">Share this login link</p>
                <p className="mt-1 font-mono text-sm">/login → Student account</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/login" target="_blank">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Open login page
                  </Link>
                </Button>
                {can(Permission.CANDIDATE_READ) && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/candidates">
                      Manage students
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Setup checklist hint when incomplete */}
          {setup && !setupComplete && (
            <Card className="surface-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Full setup checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {setup.steps.slice(0, 6).map((step) => (
                  <Link
                    key={step.id}
                    href={step.href}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={cn('flex-1 truncate', step.done && 'text-muted-foreground')}>
                      {step.title}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
