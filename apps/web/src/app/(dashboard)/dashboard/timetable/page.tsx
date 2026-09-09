'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { batchesApi, schoolApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission, DayOfWeek } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { CalendarDays, Plus, Pencil } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';

type Batch = {
  id: string;
  name: string;
  academicYear: string;
  academicClass: { id: string; name: string; subjects?: { id: string; name: string; code: string }[] };
};

type TimetableSlot = {
  id: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  room?: string | null;
  subject: { id: string; name: string; code: string };
  teacher?: { id: string; firstName: string; lastName: string } | null;
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

export default function TimetablePage() {
  const { accessToken } = useRequireAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage = can(Permission.TIMETABLE_MANAGE);

  const [batchId, setBatchId] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editCell, setEditCell] = useState<{ day: DayOfWeek; period: number } | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [room, setRoom] = useState('');

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<Batch[]>,
    enabled: !!accessToken,
  });

  const activeBatchId = batchId || batches[0]?.id || '';

  const { data: batchDetail } = useQuery({
    queryKey: ['batch', activeBatchId],
    queryFn: () => batchesApi.get(accessToken!, activeBatchId) as Promise<Batch>,
    enabled: !!accessToken && !!activeBatchId,
  });

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable', activeBatchId],
    queryFn: () => schoolApi.getTimetable(accessToken!, activeBatchId) as Promise<{
      periods: { periodNumber: number; label: string; startTime: string; endTime: string }[];
      slots: TimetableSlot[];
      days: DayOfWeek[];
    }>,
    enabled: !!accessToken && !!activeBatchId,
  });

  const slotMap = useMemo(() => {
    const map = new Map<string, TimetableSlot>();
    timetable?.slots.forEach((s) => map.set(`${s.dayOfWeek}-${s.periodNumber}`, s));
    return map;
  }, [timetable]);

  const saveMutation = useMutation({
    mutationFn: () =>
      schoolApi.upsertTimetableSlot(accessToken!, {
        batchId: activeBatchId,
        subjectId,
        dayOfWeek: editCell!.day,
        periodNumber: editCell!.period,
        room: room || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Timetable updated' });
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ['timetable', activeBatchId] });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (day: DayOfWeek, period: number) => {
    const slot = slotMap.get(`${day}-${period}`);
    setEditCell({ day, period });
    setSubjectId(slot?.subject.id ?? batchDetail?.academicClass.subjects?.[0]?.id ?? '');
    setRoom(slot?.room ?? '');
    setEditOpen(true);
  };

  const days = (timetable?.days ?? []).filter((d) => d !== DayOfWeek.SUNDAY);
  const periods = timetable?.periods ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description="Weekly class schedule by section. Assign subjects to each period."
        badge="Daily Operations"
      />

      <Card>
        <CardHeader>
          <div className="max-w-sm space-y-2">
            <Label>Class / Section</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={activeBatchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={batchesLoading}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.academicClass.name} — {b.name} ({b.academicYear})
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Period</th>
                    {days.map((d) => (
                      <th key={d} className="px-3 py-2 text-center font-medium">{DAY_LABELS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.periodNumber} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">
                        <div className="font-medium text-foreground">{p.label}</div>
                        <div className="text-xs">{p.startTime}–{p.endTime}</div>
                      </td>
                      {days.map((d) => {
                        const slot = slotMap.get(`${d}-${p.periodNumber}`);
                        return (
                          <td key={d} className="border-l px-2 py-2 align-top">
                            {slot ? (
                              <button
                                type="button"
                                disabled={!canManage}
                                onClick={() => canManage && openEdit(d, p.periodNumber)}
                                className="w-full rounded-lg bg-primary/5 p-2 text-left hover:bg-primary/10 disabled:cursor-default"
                              >
                                <div className="font-medium text-primary">{slot.subject.name}</div>
                                {slot.room && <div className="text-xs text-muted-foreground">Room {slot.room}</div>}
                              </button>
                            ) : canManage ? (
                              <button
                                type="button"
                                onClick={() => openEdit(d, p.periodNumber)}
                                className="flex h-14 w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            ) : (
                              <div className="h-14 rounded-lg bg-muted/30" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Assign period
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subject</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {(batchDetail?.academicClass.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Room (optional)</Label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!subjectId || saveMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
