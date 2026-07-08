'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { examsApi, resultsApi, candidatesApi, authApi, learningApi } from '@/lib/api';
import { useRequireCandidate } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { isAdmin, normalizeRoles } from '@/lib/roles';
import { Logo } from '@/components/layout/logo';
import { StatCard } from '@/components/layout/stat-card';
import { EmptyState } from '@/components/layout/data-table';
import { AdmitCardDialog, type AdmitCard } from '@/components/candidate/admit-card-dialog';
import { KycSubmitCard } from '@/components/candidate/kyc-submit-card';
import { CertificateDialog } from '@/components/candidate/certificate-dialog';
import type { CertificateData } from '@/lib/certificate';
import { toast } from '@/hooks/use-toast';
import { getExamStatus, formatCountdown } from '@/lib/exam-status';
import { DEFAULT_EXAM_TIMEZONE } from '@cbt/shared';
import { formatExamTimeRange } from '@/lib/exam-dates';
import { formatRankLabel } from '@/lib/rank';
import { useNow } from '@/hooks/use-now';
import {
  LogOut, Play, Clock, Award, FileText, Moon, Sun, Shield, Download, IdCard,
  Search, CheckCircle2, AlertCircle, BookOpen, Wifi, Monitor, User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ExamRegistration = {
  id: string;
  examId: string;
  exam: {
    title: string; code: string; status: string;
    startTime: string; endTime: string; timezone?: string;
    settings?: { durationMinutes: number };
  };
  sessions?: { status: string }[];
};

type CandidateDashboard = {
  profile: {
    registrationNumber: string;
    kycStatus: string;
    email: string;
    fullName: string;
  };
  stats: {
    totalExams: number;
    submittedExams: number;
    inProgressExams: number;
    publishedResults: number;
    averageScore: number | null;
  };
};

type Tab = 'exams' | 'results' | 'progress';

const KYC_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'destructive',
  NOT_SUBMITTED: 'outline',
};

const READINESS_ITEMS = [
  { icon: Wifi, label: 'Stable internet connection' },
  { icon: BookOpen, label: 'Quiet place to focus on the test' },
  { icon: Monitor, label: 'Laptop or tablet with a modern browser' },
  { icon: User, label: 'Your institute login credentials' },
];

export default function MyExamsPage() {
  const router = useRouter();
  const { accessToken, ready } = useRequireCandidate();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [admitCard, setAdmitCard] = useState<AdmitCard | null>(null);
  const [loadingAdmit, setLoadingAdmit] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loadingCertificate, setLoadingCertificate] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('exams');
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  const now = useNow(15_000);

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ['my-exams'],
    queryFn: () => examsApi.myExams(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 60_000,
  });

  const { data: results } = useQuery({
    queryKey: ['my-results'],
    queryFn: () => resultsApi.my(accessToken!),
    enabled: !!accessToken,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['candidate-dashboard'],
    queryFn: () => candidatesApi.dashboard(accessToken!) as Promise<CandidateDashboard>,
    enabled: !!accessToken,
  });

  const { data: learning } = useQuery({
    queryKey: ['student-learning'],
    queryFn: () => learningApi.studentDashboard(accessToken!) as Promise<{
      batches: { name: string; academicClass: { name: string } }[];
      stats: { averageScore: number | null; weakTopics: number; masteredTopics: number };
      weakAreas: { reason: string; topic: { title: string; chapter?: { title: string } } }[];
      topicMasteries: { accuracy: number; topic: { title: string } }[];
    }>,
    enabled: !!accessToken,
  });

  const examList = (exams as ExamRegistration[]) || [];
  const resultList = (results as { items?: {
    id: string; totalScore: number; maxScore: number; percentage: number;
    rank?: number | null; percentile?: number | null; totalCandidates?: number | null;
    published: boolean; exam: { title: string; code: string; settings?: { passingScore?: number } };
  }[] })?.items || [];

  const filteredExams = examList.filter((reg) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return reg.exam.title.toLowerCase().includes(q) || reg.exam.code.toLowerCase().includes(q);
  });

  const stats = dashboard?.stats;
  const profile = dashboard?.profile;

  async function showAdmitCard(examId: string) {
    if (!accessToken) return;
    setLoadingAdmit(examId);
    try {
      const card = await candidatesApi.admitCard(accessToken, examId) as AdmitCard;
      setAdmitCard(card);
    } catch (e) {
      toast({
        title: 'Admit card unavailable',
        description: e instanceof Error ? e.message : 'Could not load admit card for this exam.',
        variant: 'destructive',
      });
    } finally {
      setLoadingAdmit(null);
    }
  }

  async function openCertificate(resultId: string) {
    if (!accessToken) return;
    setLoadingCertificate(true);
    setCertificate(null);
    try {
      const cert = await resultsApi.certificate(accessToken, resultId) as CertificateData;
      setCertificate(cert);
    } catch (e) {
      toast({
        title: 'Certificate unavailable',
        description: e instanceof Error ? e.message : 'Results must be published before downloading a certificate.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCertificate(false);
    }
  }
  if (!ready) return null;
  if (user && isAdmin(normalizeRoles(user.roles))) return null;

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';

  return (
    <div className="min-h-screen mesh-bg">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 py-1.5 pl-1.5 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-white">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-none">{user?.firstName}</p>
                {profile && (
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{profile.registrationNumber}</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={async () => {
              const token = useAuthStore.getState().accessToken;
              if (token) await authApi.logout(token).catch(() => {});
              await logout();
              window.location.href = '/login';
            }}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10 animate-fade-in">
        <div className="hero-banner">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary">Good {greeting}, {user?.firstName}</p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Student Portal</h1>
              {learning?.batches?.length ? (
                <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                  <BookOpen className="h-3.5 w-3.5" />
                  {learning.batches.map((b) => `${b.academicClass.name} · ${b.name}`).join(' · ')}
                </p>
              ) : null}
              <p className="max-w-lg text-muted-foreground">
                Take NCERT-aligned class tests, review chapter-wise scores, and track your syllabus progress.
              </p>
            </div>
            {profile && (
              <Card className="surface-card shrink-0 border-primary/20 lg:w-72">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profile</p>
                    <Badge variant={KYC_VARIANTS[profile.kycStatus] ?? 'outline'}>
                      KYC {profile.kycStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="font-bold">{profile.fullName}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <p className="font-mono text-xs font-semibold text-primary">{profile.registrationNumber}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Class Tests" value={stats?.totalExams ?? examList.length} icon={FileText} accent="blue" />
          <StatCard
            title="In Progress"
            value={stats?.inProgressExams ?? 0}
            icon={Clock}
            accent="amber"
            trend={stats?.inProgressExams ? 'Resume now' : undefined}
            trendUp={!!stats?.inProgressExams}
          />
          <StatCard title="Submitted" value={stats?.submittedExams ?? 0} icon={CheckCircle2} accent="green" />
          <StatCard
            title="Avg. Score"
            value={stats?.averageScore != null ? `${stats.averageScore.toFixed(1)}%` : '—'}
            icon={Award}
            accent="violet"
            trend={stats?.publishedResults ? `${stats.publishedResults} results` : undefined}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
                {(['exams', 'results', 'progress'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all',
                      tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t === 'exams' ? `Class Tests (${examList.length})` : t === 'results' ? `Results (${resultList.length})` : 'Syllabus Progress'}
                  </button>
                ))}
              </div>
              {tab === 'exams' && (
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search class tests..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
            </div>

            {tab === 'exams' && (
              <section className="space-y-3">
                {examsLoading ? <TableSkeleton rows={3} cols={1} /> : (
                  <>
                    {filteredExams.map((reg) => {
                      void now;
                      const status = getExamStatus(reg);
                      const tz = reg.exam.timezone || DEFAULT_EXAM_TIMEZONE;
                      const countdown = status.phase === 'upcoming'
                        ? formatCountdown(new Date(reg.exam.startTime).getTime())
                        : null;
                      return (
                        <Card
                          key={reg.id}
                          className={cn(
                            'surface-card group',
                            status.phase === 'available' && 'border-emerald-500/30 ring-1 ring-emerald-500/10',
                            status.phase === 'in_progress' && 'border-amber-500/30 ring-1 ring-amber-500/10',
                          )}
                        >
                          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105',
                                status.phase === 'available' ? 'bg-emerald-500/10 text-emerald-600' :
                                status.phase === 'in_progress' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-primary/10 text-primary',
                              )}>
                                <FileText className="h-6 w-6" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold">{reg.exam.title}</h3>
                                  <Badge variant={status.variant}>{status.label}</Badge>
                                  {countdown && (
                                    <Badge variant="outline" className="font-mono text-xs">
                                      Opens in {countdown}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{reg.exam.code}</p>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    {reg.exam.settings?.durationMinutes ?? 30} min
                                  </span>
                                  <span>
                                    {formatExamTimeRange(reg.exam.startTime, reg.exam.endTime, tz)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => showAdmitCard(reg.examId)}
                                disabled={loadingAdmit === reg.examId}
                              >
                                <IdCard className="mr-2 h-4 w-4" />
                                {loadingAdmit === reg.examId ? 'Loading...' : 'Admit Card'}
                              </Button>
                              <Button
                                onClick={() => router.push(`/exam/instructions/${reg.examId}`)}
                                disabled={status.actionDisabled}
                                variant={status.actionDisabled ? 'secondary' : 'default'}
                                className={status.phase === 'available' || status.phase === 'in_progress' ? 'gradient-primary border-0' : ''}
                              >
                                <Play className="mr-2 h-4 w-4" /> {status.actionLabel}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {!filteredExams.length && (
                      <Card className="surface-card">
                        <EmptyState
                          icon={search ? Search : FileText}
                          title={search ? 'No tests match your search' : 'No class tests assigned yet'}
                          description={search ? 'Try a different search term.' : 'Your teacher will assign NCERT class tests after publishing them for your batch.'}
                        />
                      </Card>
                    )}
                  </>
                )}
              </section>
            )}

            {tab === 'results' && (
              <section className="space-y-3">
                {resultList.map((r) => {
                  const pct = Math.min(100, r.percentage);
                  const passingScore = (r.exam.settings?.passingScore as number | undefined) ?? 40;
                  const passed = pct >= passingScore;
                  const rankLabel = formatRankLabel(r.rank, r.totalCandidates);
                  return (
                    <Card key={r.id} className="surface-card">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'flex h-12 w-12 items-center justify-center rounded-2xl',
                              passed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600',
                            )}>
                              <Award className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-bold">{r.exam.title}</p>
                              <p className="text-sm text-muted-foreground">{r.exam.code}</p>
                              {rankLabel && (
                                <p className="mt-1 text-xs font-semibold text-primary">{rankLabel}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-2xl font-bold tabular-nums text-primary">
                                {r.totalScore}<span className="text-base font-normal text-muted-foreground">/{r.maxScore}</span>
                              </p>
                              <p className="text-sm font-semibold text-muted-foreground">{r.percentage.toFixed(1)}%</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => openCertificate(r.id)} disabled={loadingCertificate}>
                              <Download className="mr-2 h-3.5 w-3.5" /> Certificate
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Score</span>
                            <span className={passed ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {passed ? 'Passed' : 'Below cutoff'}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full transition-all', passed ? 'bg-emerald-500' : 'bg-red-500')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {!resultList.length && (
                  <Card className="surface-card">
                    <EmptyState
                      icon={Award}
                      title="No results published yet"
                      description="Your exam scores will appear here once results are published by the administrator."
                    />
                  </Card>
                )}
              </section>
            )}

            {tab === 'progress' && (
              <section className="space-y-4">
                {learning?.batches?.length ? (
                  <Card className="surface-card">
                    <CardContent className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Your Batch</p>
                      {learning.batches.map((b, i) => (
                        <p key={i} className="font-semibold">{b.name} — {b.academicClass.name}</p>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard title="Mastered Topics" value={learning?.stats?.masteredTopics ?? 0} icon={CheckCircle2} accent="green" />
                  <StatCard title="Weak Areas" value={learning?.stats?.weakTopics ?? 0} icon={AlertCircle} accent="amber" />
                  <StatCard
                    title="Avg. Score"
                    value={learning?.stats?.averageScore != null ? `${learning.stats.averageScore.toFixed(1)}%` : '—'}
                    icon={Award}
                    accent="violet"
                  />
                </div>

                {learning?.weakAreas?.length ? (
                  <Card className="surface-card border-destructive/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-destructive">Revision Recommended</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {learning.weakAreas.map((w, i) => (
                        <div key={i} className="rounded-lg bg-destructive/5 px-4 py-3 text-sm">
                          <p className="font-medium">{w.topic.title}</p>
                          <p className="text-muted-foreground">{w.reason}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                {learning?.topicMasteries?.length ? (
                  <Card className="surface-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Topic Mastery</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {learning.topicMasteries.map((m, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{m.topic.title}</span>
                            <span className={m.accuracy >= 70 ? 'text-emerald-600' : 'text-amber-600'}>
                              {m.accuracy.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.accuracy >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${m.accuracy}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="surface-card">
                    <EmptyState
                      icon={BookOpen}
                      title="Start practicing"
                      description="Complete AI-generated tests to build your topic mastery profile."
                    />
                  </Card>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-4">
            {accessToken && profile && (
              <KycSubmitCard accessToken={accessToken} kycStatus={profile.kycStatus} />
            )}
            <Card className="surface-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Exam Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {READINESS_ITEMS.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span>{label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="surface-card border-primary/20">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <BookOpen className="h-4 w-4 text-primary" />
                  NCERT Class Tests
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tests are based on chapters your class has studied. Read each question carefully —
                  some tests may use negative marking. Your answers are saved automatically.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>

        <div className="flex items-center justify-center gap-2 pb-4 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          NCERT Institute · Classes 9–12
        </div>
      </main>

      <AdmitCardDialog card={admitCard} onClose={() => setAdmitCard(null)} />
      <CertificateDialog
        certificate={certificate}
        loading={loadingCertificate && !certificate}
        onClose={() => setCertificate(null)}
      />
    </div>
  );
}
