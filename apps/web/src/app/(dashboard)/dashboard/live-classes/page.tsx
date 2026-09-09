'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/layout/data-table';
import { batchesApi, schoolApi, usersApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission, LiveClassProvider, LiveClassStatus } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { Video, Plus, ExternalLink, Radio } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatExamDateTime } from '@/lib/exam-dates';
import { cn } from '@/lib/utils';

type Batch = {
  id: string;
  name: string;
  academicClass: { id: string; name: string; subjects?: { id: string; name: string; code: string }[] };
};

type LiveClassItem = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  provider: LiveClassProvider;
  meetingUrl: string;
  recordingUrl?: string | null;
  status: LiveClassStatus;
  subject: { name: string };
  batch: { name: string; academicClass: { name: string } };
  teacher: { id: string; firstName: string; lastName: string };
  _count: { joins: number };
};

const PROVIDERS: { value: LiveClassProvider; label: string; hint: string }[] = [
  { value: LiveClassProvider.JITSI, label: 'Jitsi (free, auto room)', hint: 'Room link generated automatically' },
  { value: LiveClassProvider.ZOOM, label: 'Zoom', hint: 'Paste your Zoom meeting link' },
  { value: LiveClassProvider.GOOGLE_MEET, label: 'Google Meet', hint: 'Paste your Meet link' },
  { value: LiveClassProvider.MICROSOFT_TEAMS, label: 'Microsoft Teams', hint: 'Paste your Teams link' },
  { value: LiveClassProvider.CUSTOM, label: 'Other link', hint: 'Any video call URL' },
];

const STATUS_STYLE: Record<LiveClassStatus, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-700',
  LIVE: 'bg-red-500/10 text-red-700 animate-pulse',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export default function LiveClassesPage() {
  const { accessToken } = useRequireAuth();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage = can(Permission.LIVE_CLASS_MANAGE);

  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState(user?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [provider, setProvider] = useState<LiveClassProvider>(LiveClassProvider.JITSI);
  const [meetingUrl, setMeetingUrl] = useState('');

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['live-classes'],
    queryFn: () => schoolApi.listLiveClasses(accessToken!) as Promise<LiveClassItem[]>,
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<Batch[]>,
    enabled: !!accessToken,
  });

  const activeBatchId = batchId || batches[0]?.id || '';
  const { data: batchDetail } = useQuery({
    queryKey: ['batch', activeBatchId],
    queryFn: () => batchesApi.get(accessToken!, activeBatchId) as Promise<Batch>,
    enabled: !!accessToken && !!activeBatchId && open,
  });

  const { data: staffPage } = useQuery({
    queryKey: ['staff-teachers'],
    queryFn: () => usersApi.list(accessToken!, 1, '', 100) as Promise<{ items: { id: string; firstName: string; lastName: string; userRoles: { role: { name: string } }[] }[] }>,
    enabled: !!accessToken && open,
  });

  const teachers = (staffPage?.items ?? []).filter((u) =>
    u.userRoles.some((r) => ['TEACHER', 'INSTITUTE_ADMIN', 'ORG_ADMIN'].includes(r.role.name)),
  );

  const createMutation = useMutation({
    mutationFn: () =>
      schoolApi.createLiveClass(accessToken!, {
        batchId: activeBatchId,
        subjectId: subjectId || batchDetail?.academicClass.subjects?.[0]?.id,
        teacherId: teacherId || user?.id,
        title,
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        provider,
        meetingUrl: provider === LiveClassProvider.JITSI ? undefined : meetingUrl,
      }),
    onSuccess: () => {
      toast({ title: 'Live class scheduled' });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['live-classes'] });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LiveClassStatus }) =>
      schoolApi.updateLiveClassStatus(accessToken!, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live-classes'] }),
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => schoolApi.joinLiveClass(accessToken!, id) as Promise<{ meetingUrl: string }>,
    onSuccess: (data) => {
      window.open(data.meetingUrl, '_blank', 'noopener,noreferrer');
    },
    onError: (e: Error) => toast({ title: 'Cannot join', description: e.message, variant: 'destructive' }),
  });

  const liveNow = classes.filter((c) => c.status === LiveClassStatus.LIVE);
  const upcoming = classes.filter((c) => c.status === LiveClassStatus.SCHEDULED);
  const past = classes.filter((c) => c.status === LiveClassStatus.COMPLETED || c.status === LiveClassStatus.CANCELLED);

  const renderClass = (lc: LiveClassItem) => (
    <Card key={lc.id} className={lc.status === LiveClassStatus.LIVE ? 'border-red-300 ring-1 ring-red-200' : ''}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{lc.title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {lc.batch.academicClass.name} — {lc.batch.name} · {lc.subject.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {lc.teacher.firstName} {lc.teacher.lastName} · {formatExamDateTime(lc.startTime)} – {formatExamDateTime(lc.endTime)}
            </p>
          </div>
          <Badge className={cn('shrink-0', STATUS_STYLE[lc.status])}>{lc.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{lc.provider.replace('_', ' ')}</Badge>
        <span className="text-xs text-muted-foreground">{lc._count.joins} joined</span>
        {(lc.status === LiveClassStatus.LIVE || lc.status === LiveClassStatus.SCHEDULED) && (
          <Button size="sm" onClick={() => joinMutation.mutate(lc.id)} disabled={joinMutation.isPending}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Join VC
          </Button>
        )}
        {canManage && lc.status === LiveClassStatus.SCHEDULED && (
          <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate({ id: lc.id, status: LiveClassStatus.LIVE })}>
            <Radio className="mr-1.5 h-3.5 w-3.5" /> Start live
          </Button>
        )}
        {canManage && lc.status === LiveClassStatus.LIVE && (
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: lc.id, status: LiveClassStatus.COMPLETED })}>
            End class
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Classes"
        description="Schedule video classes on Jitsi, Zoom, Google Meet, or Teams. Students join with one click."
        badge="Video Conference"
      >
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Schedule class
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : classes.length === 0 ? (
        <div className="space-y-4">
          <EmptyState icon={Video} title="No live classes yet" description="Schedule your first video class for a section." />
          {canManage && (
            <div className="flex justify-center">
              <Button onClick={() => setOpen(true)}>Schedule class</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {liveNow.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-red-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live now
              </h2>
              {liveNow.map(renderClass)}
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Upcoming</h2>
              {upcoming.map(renderClass)}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Past</h2>
              {past.slice(0, 10).map(renderClass)}
            </section>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule live class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class / Section</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={activeBatchId} onChange={(e) => { setBatchId(e.target.value); setSubjectId(''); }}>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.academicClass.name} — {b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={subjectId || batchDetail?.academicClass.subjects?.[0]?.id || ''} onChange={(e) => setSubjectId(e.target.value)}>
                {(batchDetail?.academicClass.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Teacher</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={teacherId || user?.id || ''} onChange={(e) => setTeacherId(e.target.value)}>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Math — Chapter 5 live lecture" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Video platform</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={provider} onChange={(e) => setProvider(e.target.value as LiveClassProvider)}>
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{PROVIDERS.find((p) => p.value === provider)?.hint}</p>
            </div>
            {provider !== LiveClassProvider.JITSI && (
              <div className="space-y-2">
                <Label>Meeting link</Label>
                <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!title || !startTime || !endTime || createMutation.isPending}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
