'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { examsApi, type ExamListItem } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/data-table';
import { ExamAssignCandidatesDialog } from '@/components/admin/exam-assign-candidates-dialog';
import { toast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_EXAM_TIMEZONE, localDateTimeToUtcIso } from '@cbt/shared';
import { EXAM_TIMEZONE_OPTIONS, formatExamTimeRange, utcIsoToLocalDateTimeInput } from '@/lib/exam-dates';
import { FileText, Users, Clock, HelpCircle, GraduationCap } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';

type ExamItem = ExamListItem;

function questionCount(exam: ExamItem) {
  return (exam.sections || []).reduce((sum, s) => sum + (s._count?.questions ?? 0), 0);
}

export default function ExamsPage() {
  const { accessToken } = useRequireAuth(true);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [candidatesDialog, setCandidatesDialog] = useState<{ examId: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; code: string } | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ExamItem | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ startTime: '', endTime: '', timezone: DEFAULT_EXAM_TIMEZONE });

  const { data, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => examsApi.publish(accessToken!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({ title: 'Exam published', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Cannot publish', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examsApi.remove(accessToken!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setDeleteTarget(null);
      toast({ title: 'Exam deleted', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Cannot delete exam', description: e.message, variant: 'destructive' }),
  });

  const scheduleMutation = useMutation({
    mutationFn: () => examsApi.updateSchedule(accessToken!, scheduleTarget!.id, {
      startTime: localDateTimeToUtcIso(scheduleForm.startTime, scheduleForm.timezone),
      endTime: localDateTimeToUtcIso(scheduleForm.endTime, scheduleForm.timezone),
      timezone: scheduleForm.timezone,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setScheduleTarget(null);
      toast({ title: 'Schedule updated', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  function openScheduleEdit(exam: ExamItem) {
    const tz = exam.timezone || DEFAULT_EXAM_TIMEZONE;
    setScheduleForm({
      startTime: utcIsoToLocalDateTimeInput(exam.startTime, tz),
      endTime: utcIsoToLocalDateTimeInput(exam.endTime, tz),
      timezone: tz,
    });
    setScheduleTarget(exam);
  }

  function canDeleteExam(exam: ExamItem) {
    if (exam.status === 'COMPLETED') return false;
    if ((exam._count?.sessions ?? 0) > 0) return false;
    if ((exam._count?.results ?? 0) > 0) return false;
    return true;
  }

  if (isLoading) return <TableSkeleton rows={3} cols={1} />;

  const items: ExamItem[] = data?.items || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Exams"
        description="Publish and manage tests created from Create Test"
        badge="Core"
      />

      <div className="space-y-3">
        {items.map((exam) => {
          const qCount = questionCount(exam);
          const cCount = exam._count?.registrations ?? 0;
          const batch = exam.aiTestConfig?.batch;
          const readyToPublish = qCount > 0 && cCount > 0;

          return (
            <Card key={exam.id} className="surface-card group">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{exam.title}</h3>
                      <Badge variant={exam.status === 'PUBLISHED' ? 'success' : 'warning'}>{exam.status}</Badge>
                      {batch && (
                        <Badge variant="secondary" className="gap-1 normal-case tracking-normal">
                          <GraduationCap className="h-3 w-3" />
                          {batch.academicClass.name} · {batch.name}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{exam.code}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{qCount} question{qCount === 1 ? '' : 's'}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cCount} candidate{cCount === 1 ? '' : 's'}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatExamTimeRange(exam.startTime, exam.endTime, exam.timezone || DEFAULT_EXAM_TIMEZONE)}
                      </span>
                    </div>
                    {exam.status === 'DRAFT' && !readyToPublish && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        {qCount === 0 && cCount === 0 && 'Finish question review in Create Test, then manage students here.'}
                        {qCount === 0 && cCount > 0 && 'Questions are added from Create Test — finish review there first.'}
                        {qCount > 0 && cCount === 0 && batch
                          ? `No students selected for ${batch.name}. Open Students to include batch members.`
                          : qCount > 0 && cCount === 0 && 'Select at least one student to publish.'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exam.status === 'DRAFT' && (
                    <>
                      {can(Permission.EXAM_UPDATE) && (
                        <Button size="sm" variant="outline" onClick={() => openScheduleEdit(exam)}>
                          Edit Schedule
                        </Button>
                      )}
                      {can(Permission.EXAM_ASSIGN_CANDIDATES) && batch && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCandidatesDialog({ examId: exam.id, title: exam.title })}
                      >
                        Students ({cCount})
                      </Button>
                      )}
                      {can(Permission.EXAM_PUBLISH) && (
                      <Button
                        size="sm"
                        onClick={() => publishMutation.mutate(exam.id)}
                        disabled={!readyToPublish || publishMutation.isPending}
                      >
                        Publish
                      </Button>
                      )}
                    </>
                  )}
                  {can(Permission.EXAM_DELETE) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={!canDeleteExam(exam)}
                      title={
                        !canDeleteExam(exam)
                          ? 'Cannot delete: exam is completed or candidates have taken it'
                          : 'Permanently delete this exam'
                      }
                      onClick={() => setDeleteTarget({ id: exam.id, title: exam.title, code: exam.code })}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!items.length && (
          <Card className="surface-card">
            <EmptyState
              icon={FileText}
              title="No exams yet"
              description="Create a test from Create Test — it will appear here for publishing and candidate assignment."
            />
            <div className="flex justify-center pb-8">
              <Button asChild>
                <Link href="/dashboard/ai-tests">Go to Create Test</Link>
              </Button>
            </div>
          </Card>
        )}
      </div>

      {candidatesDialog && accessToken && (
        <ExamAssignCandidatesDialog
          accessToken={accessToken}
          examId={candidatesDialog.examId}
          examTitle={candidatesDialog.title}
          open={!!candidatesDialog}
          onOpenChange={(open) => !open && setCandidatesDialog(null)}
        />
      )}

      <Dialog open={!!scheduleTarget} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit exam schedule</DialogTitle>
            <DialogDescription>
              Update start/end times for <span className="font-medium">{scheduleTarget?.title}</span>. Times use the selected timezone.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="datetime-local" value={scheduleForm.startTime} onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="datetime-local" value={scheduleForm.endTime} onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={scheduleForm.timezone}
                onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })}
              >
                {EXAM_TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleTarget(null)}>Cancel</Button>
            <Button
              disabled={scheduleMutation.isPending || !scheduleForm.startTime || !scheduleForm.endTime}
              onClick={() => scheduleMutation.mutate()}
            >
              {scheduleMutation.isPending ? 'Saving...' : 'Save schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete exam?</DialogTitle>
            <DialogDescription>
              Permanently delete <span className="font-medium text-foreground">{deleteTarget?.title}</span> ({deleteTarget?.code}).
              This removes all questions, candidate assignments, and exam settings. Questions in the bank are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
