'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEFAULT_EXAM_TIMEZONE } from '@cbt/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { examsApi } from '@/lib/api';
import { useRequireCandidate } from '@/hooks/use-auth';
import { Logo } from '@/components/layout/logo';
import { getExamStatus } from '@/lib/exam-status';
import { formatExamTimeRange } from '@/lib/exam-dates';
import { normalizeSecurityPolicy, requestDocumentFullscreen } from '@/lib/exam-security-policy';
import { AlertTriangle, Clock, Shield, CheckCircle2, ArrowLeft, Calendar } from 'lucide-react';

type ExamInstructions = {
  title: string;
  code: string;
  status: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  settings?: { durationMinutes: number; passingScore: number; negativeMarking: boolean };
  securityPolicy?: { fullscreen?: boolean; fullscreenRequired?: boolean; blockCopyPaste?: boolean; proctoringEnabled?: boolean };
  registration: { sessions?: { status: string }[] };
};

export default function ExamInstructionsPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const { accessToken, user, ready } = useRequireCandidate();
  const [exam, setExam] = useState<ExamInstructions | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !accessToken) return;
    examsApi.instructions(accessToken, examId)
      .then((data) => setExam(data as ExamInstructions))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load exam'));
  }, [accessToken, examId, ready]);

  if (!ready) return null;
  if (error) return (
    <div className="flex min-h-screen items-center justify-center mesh-bg p-4">
      <Card className="max-w-md p-6"><p className="text-destructive">{error}</p><Button className="mt-4" onClick={() => router.push('/my-exams')}>Back</Button></Card>
    </div>
  );
  if (!exam) return <div className="flex min-h-screen items-center justify-center mesh-bg">Loading exam details...</div>;

  const settings = exam.settings ?? { durationMinutes: 30, passingScore: 40, negativeMarking: true };
  const security = normalizeSecurityPolicy(exam.securityPolicy);
  const tz = exam.timezone || DEFAULT_EXAM_TIMEZONE;
  const status = getExamStatus({
    exam: { status: exam.status, startTime: exam.startTime, endTime: exam.endTime },
    sessions: exam.registration.sessions,
  });
  const canBegin = agreed && !status.actionDisabled;

  return (
    <div className="min-h-screen mesh-bg">
      <header className="border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Logo />
          <Button variant="ghost" size="sm" onClick={() => router.push('/my-exams')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6 py-10">
        <div className="space-y-2 text-center">
          <Badge variant="secondary" className="mb-2">{exam.code}</Badge>
          <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
          <p className="text-muted-foreground">Please read all instructions carefully before starting</p>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <Card className="surface-card">
          <CardContent className="flex items-start gap-3 p-5">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">Exam Schedule</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatExamTimeRange(exam.startTime, exam.endTime, tz)}
              </p>
            </div>
          </CardContent>
        </Card>

        {status.actionDisabled && status.phase !== 'submitted' && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">
              {status.phase === 'upcoming' && 'This exam is not open yet. Check the schedule above.'}
              {status.phase === 'ended' && 'The exam window has ended. You can no longer start this exam.'}
              {status.phase === 'unavailable' && 'This exam is not available for taking right now.'}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Duration', value: `${settings.durationMinutes} min`, icon: Clock },
            { label: 'Pass Score', value: `${settings.passingScore}%`, icon: CheckCircle2 },
            { label: 'Negative', value: settings.negativeMarking ? 'Yes' : 'No', icon: AlertTriangle },
          ].map((s) => (
            <Card key={s.label} className="surface-card text-center">
              <CardContent className="p-5">
                <s.icon className="mx-auto mb-2 h-5 w-5 text-primary" />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="surface-card border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-amber-600" /> Security Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {security.fullscreen && <p>• Fullscreen mode is mandatory</p>}
            {security.blockCopyPaste && <p>• Copy, paste, and right-click are disabled</p>}
            <p>• Tab switching is monitored and recorded</p>
            {security.proctoringEnabled && <p>• AI proctoring is active — violations may terminate your session</p>}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader className="pb-3"><CardTitle className="text-base">General Instructions</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p>1. Ensure a stable internet connection before starting.</p>
            <p>2. Do not refresh or close the browser during the exam.</p>
            <p>3. Use &quot;Mark for Review&quot; to revisit questions later.</p>
            <p>4. The timer auto-submits when time expires.</p>
          </CardContent>
        </Card>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-5 shadow-card">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" disabled={status.actionDisabled} />
          <span className="text-sm">
            I, <strong>{user?.firstName} {user?.lastName}</strong>, confirm that I have read and understood all exam rules and agree to comply with security policies.
          </span>
        </label>

        <Button
          className="w-full shadow-sm"
          size="lg"
          disabled={!canBegin}
          onClick={() => {
            if (security.fullscreen) {
              // Fire synchronously while the click gesture is active; navigation can
              // cancel fullscreen if we await before routing.
              void requestDocumentFullscreen();
            }
            router.push(`/exam/start/${examId}`);
          }}
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          {status.phase === 'in_progress' ? 'Resume Examination' : 'Begin Examination'}
        </Button>
      </main>
    </div>
  );
}
