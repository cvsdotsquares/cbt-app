'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { batchesApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { School, Trash2 } from 'lucide-react';

type TeachingAssignment = {
  id: string;
  batchId: string;
  subjectId: string;
  subject: { id: string; name: string; code?: string };
  batch: {
    id: string;
    name: string;
    academicYear: string;
    academicClass: { id: string; name: string; level: number };
  };
};

type BatchOption = {
  id: string;
  name: string;
  academicYear: string;
  academicClass: { id: string; name: string; level: number };
};

type StaffTeacher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

interface AssignTeacherClassesDialogProps {
  accessToken: string;
  teacher: StaffTeacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignTeacherClassesDialog({
  accessToken,
  teacher,
  open,
  onOpenChange,
}: AssignTeacherClassesDialogProps) {
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const { data: batches } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken) as Promise<BatchOption[]>,
    enabled: open && !!accessToken,
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['teacher-assignments', teacher?.id],
    queryFn: () =>
      batchesApi.listTeacherAssignmentsByUser(accessToken, teacher!.id) as Promise<TeachingAssignment[]>,
    enabled: open && !!accessToken && !!teacher?.id,
  });

  const { data: batchDetail } = useQuery({
    queryKey: ['batch-detail', batchId],
    queryFn: () => batchesApi.get(accessToken, batchId) as Promise<{
      academicClass: { subjects?: { id: string; name: string }[] };
    }>,
    enabled: open && !!accessToken && !!batchId,
  });

  const subjects = batchDetail?.academicClass.subjects ?? [];

  const sortedBatches = useMemo(
    () =>
      [...(batches ?? [])].sort(
        (a, b) =>
          a.academicClass.level - b.academicClass.level
          || a.name.localeCompare(b.name, undefined, { numeric: true }),
      ),
    [batches],
  );

  const assignMutation = useMutation({
    mutationFn: () =>
      batchesApi.assignTeacher(accessToken, batchId, {
        userId: teacher!.id,
        subjectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', teacher?.id] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setSubjectId('');
      toast({ title: 'Class assigned', variant: 'success' });
    },
    onError: (e: Error) =>
      toast({ title: 'Could not assign', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (a: TeachingAssignment) =>
      batchesApi.removeTeacher(accessToken, a.batchId, a.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', teacher?.id] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast({ title: 'Assignment removed', variant: 'success' });
    },
    onError: (e: Error) =>
      toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }),
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setBatchId('');
      setSubjectId('');
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            Assign classes
          </DialogTitle>
          <DialogDescription>
            {teacher && (
              <>
                Assign{' '}
                <span className="font-medium text-foreground">
                  {teacher.firstName} {teacher.lastName}
                </span>{' '}
                to a batch and subject. They will only see that class’s syllabus, books, students, and tests.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Batch / Class</label>
              <select
                className="mt-1.5 flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value);
                  setSubjectId('');
                }}
              >
                <option value="">Choose batch…</option>
                {sortedBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.academicClass.name} — {b.name} ({b.academicYear})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Subject</label>
              <select
                className="mt-1.5 flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={subjectId}
                disabled={!batchId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Choose subject…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <Button
              className="w-full"
              disabled={!batchId || !subjectId || assignMutation.isPending || !teacher}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? 'Assigning…' : 'Assign class & subject'}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Current assignments ({assignments?.length ?? 0})
            </p>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (assignments ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                No classes assigned yet.
              </p>
            ) : (
              (assignments ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {a.batch.academicClass.name} — {a.batch.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="normal-case tracking-normal">
                        {a.subject.name}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{a.batch.academicYear}</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-destructive"
                    disabled={removeMutation.isPending}
                    title="Remove assignment"
                    onClick={() => removeMutation.mutate(a)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
