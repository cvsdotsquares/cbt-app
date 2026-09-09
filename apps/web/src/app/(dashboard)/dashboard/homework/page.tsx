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
import { batchesApi, schoolApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { NotebookPen, Plus } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatExamDateTime } from '@/lib/exam-dates';

type Batch = {
  id: string;
  name: string;
  academicYear: string;
  academicClass: { id: string; name: string; subjects?: { id: string; name: string }[] };
};

type HomeworkItem = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  subject: { name: string };
  batch: { name: string; academicClass: { name: string } };
  _count: { submissions: number };
};

export default function HomeworkPage() {
  const { accessToken } = useRequireAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage = can(Permission.HOMEWORK_MANAGE);

  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<Batch[]>,
    enabled: !!accessToken,
  });

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ['homework'],
    queryFn: () => schoolApi.listHomework(accessToken!) as Promise<HomeworkItem[]>,
    enabled: !!accessToken,
  });

  const activeBatchId = batchId || batches[0]?.id || '';

  const { data: batchDetail } = useQuery({
    queryKey: ['batch', activeBatchId],
    queryFn: () => batchesApi.get(accessToken!, activeBatchId) as Promise<Batch>,
    enabled: !!accessToken && !!activeBatchId && open,
  });

  const subjects = batchDetail?.academicClass.subjects ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      schoolApi.createHomework(accessToken!, {
        batchId: activeBatchId,
        subjectId: subjectId || subjects[0]?.id,
        title,
        description,
        dueDate: new Date(dueDate).toISOString(),
      }),
    onSuccess: () => {
      toast({ title: 'Homework assigned' });
      setOpen(false);
      setTitle('');
      setDescription('');
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework"
        description="Assign homework to classes. Students submit online; teachers can grade submissions."
        badge="Daily Operations"
      >
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Assign homework
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : homeworks.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={NotebookPen}
            title="No homework yet"
            description="Assign the first homework to a class section."
          />
          {canManage && (
            <div className="flex justify-center">
              <Button onClick={() => setOpen(true)}>Assign homework</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {homeworks.map((hw) => {
            const overdue = new Date(hw.dueDate) < new Date();
            return (
              <Card key={hw.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{hw.title}</CardTitle>
                    <Badge variant={overdue ? 'destructive' : 'secondary'}>
                      {overdue ? 'Overdue' : 'Active'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hw.batch.academicClass.name} — {hw.batch.name} · {hw.subject.name}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {hw.description && <p className="text-muted-foreground line-clamp-2">{hw.description}</p>}
                  <p>Due: {formatExamDateTime(hw.dueDate)}</p>
                  <p className="text-muted-foreground">{hw._count.submissions} submission(s)</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign homework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class / Section</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={activeBatchId}
                onChange={(e) => { setBatchId(e.target.value); setSubjectId(''); }}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.academicClass.name} — {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={subjectId || subjects[0]?.id || ''}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 5 exercises" />
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!title || !dueDate || createMutation.isPending}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
