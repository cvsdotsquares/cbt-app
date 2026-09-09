'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/layout/stat-card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { batchesApi, schoolApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission, AttendanceStatus } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { UserCheck, Save, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type Batch = { id: string; name: string; academicYear: string; academicClass: { name: string } };
type StudentRow = {
  candidateId: string;
  rollNumber?: string | null;
  name: string;
  status: AttendanceStatus;
  remarks?: string | null;
};

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: AttendanceStatus.PRESENT, label: 'Present', color: 'bg-emerald-500' },
  { value: AttendanceStatus.ABSENT, label: 'Absent', color: 'bg-red-500' },
  { value: AttendanceStatus.LATE, label: 'Late', color: 'bg-amber-500' },
  { value: AttendanceStatus.LEAVE, label: 'Leave', color: 'bg-blue-500' },
  { value: AttendanceStatus.HALF_DAY, label: 'Half day', color: 'bg-violet-500' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { accessToken } = useRequireAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage = can(Permission.ATTENDANCE_MANAGE);

  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<Batch[]>,
    enabled: !!accessToken,
  });

  const activeBatchId = batchId || batches[0]?.id || '';

  const { data: sheet, isLoading: sheetLoading } = useQuery({
    queryKey: ['attendance', activeBatchId, date],
    queryFn: () => schoolApi.getAttendance(accessToken!, activeBatchId, date) as Promise<{
      batch: Batch;
      date: string;
      summary: { total: number; present: number; absent: number };
      students: StudentRow[];
    }>,
    enabled: !!accessToken && !!activeBatchId,
  });

  const students = useMemo(() => {
    if (!sheet?.students) return [];
    return sheet.students.map((s) => ({
      ...s,
      status: statusMap[s.candidateId] ?? s.status,
    }));
  }, [sheet, statusMap]);

  const saveMutation = useMutation({
    mutationFn: () =>
      schoolApi.markAttendance(accessToken!, {
        batchId: activeBatchId,
        date,
        entries: students.map((s) => ({ candidateId: s.candidateId, status: s.status })),
      }),
    onSuccess: () => {
      toast({ title: 'Attendance saved' });
      setStatusMap({});
      qc.invalidateQueries({ queryKey: ['attendance', activeBatchId, date] });
    },
    onError: (e: Error) => toast({ title: 'Failed to save', description: e.message, variant: 'destructive' }),
  });

  const markAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { next[s.candidateId] = AttendanceStatus.PRESENT; });
    setStatusMap(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark daily attendance for each class section. Teachers can mark only their assigned classes."
        badge="Daily Operations"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Students today" value={sheet?.summary.total ?? '—'} icon={UserCheck} />
        <StatCard title="Present" value={sheet?.summary.present ?? '—'} icon={UserCheck} accent="green" />
        <StatCard title="Absent" value={sheet?.summary.absent ?? '—'} icon={UserCheck} accent="amber" />
        <StatCard
          title="Attendance rate"
          value={
            sheet?.summary.total
              ? `${Math.round((sheet.summary.present / sheet.summary.total) * 100)}%`
              : '—'
          }
          icon={Calendar}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Class / Section</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={activeBatchId}
                onChange={(e) => { setBatchId(e.target.value); setStatusMap({}); }}
                disabled={batchesLoading}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.academicClass.name} — {b.name} ({b.academicYear})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={date}
                onChange={(e) => { setDate(e.target.value); setStatusMap({}); }}
              />
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={markAllPresent}>Mark all present</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !students.length}>
                <Save className="mr-2 h-4 w-4" />
                Save attendance
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {sheetLoading ? (
            <TableSkeleton rows={8} />
          ) : students.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No students enrolled in this class.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Roll</th>
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.candidateId} className="border-t">
                      <td className="px-4 py-3 text-muted-foreground">{s.rollNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setStatusMap((m) => ({ ...m, [s.candidateId]: opt.value }))}
                                className={cn(
                                  'rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                                  s.status === opt.value
                                    ? `${opt.color} text-white shadow-sm`
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline">{s.status.replace('_', ' ')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
