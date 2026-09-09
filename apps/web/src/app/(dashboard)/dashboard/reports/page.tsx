'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { schoolErpApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Users, UserCheck, IndianRupee, Award } from 'lucide-react';

type SchoolReports = {
  students: { total: number; active: number; alumni: number; newAdmissions: number };
  attendance: { todayPresent: number; todayTotal: number; todayPercent: number; lowAttendanceStudents: { name: string; attendancePercent: number }[] };
  finance: { totalDue: number; totalPaid: number; outstanding: number; defaulterCount: number; todayCollection: number; todayPaymentCount: number };
  academics: { topPerformers: { name: string; percentage: number; grade: string }[] };
  staff: { total: number };
};

export default function ReportsPage() {
  const { accessToken } = useRequireAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['school-reports'],
    queryFn: () => schoolErpApi.schoolReports(accessToken!) as Promise<SchoolReports>,
    enabled: !!accessToken,
  });

  if (isLoading) return <TableSkeleton rows={6} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="School Reports & Analytics" description="Students, attendance, finance, and academic performance at a glance." badge="Analytics" />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Students</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Students" value={String(data.students.total)} icon={Users} />
          <StatCard title="Active" value={String(data.students.active)} icon={Users} accent="green" />
          <StatCard title="New Admissions (YTD)" value={String(data.students.newAdmissions)} icon={Users} accent="violet" />
          <StatCard title="Alumni" value={String(data.students.alumni)} icon={Users} accent="amber" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attendance</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Today's Attendance" value={`${data.attendance.todayPercent}%`} icon={UserCheck} />
          <StatCard title="Present Today" value={String(data.attendance.todayPresent)} icon={UserCheck} accent="green" />
          <StatCard title="Marked Today" value={String(data.attendance.todayTotal)} icon={UserCheck} accent="blue" />
        </div>
        {data.attendance.lowAttendanceStudents.length > 0 && (
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Low Attendance (&lt;75%)</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {data.attendance.lowAttendanceStudents.map((s, i) => (
                  <li key={i} className="flex justify-between rounded border p-2">
                    <span>{s.name}</span>
                    <span className="text-red-600">{s.attendancePercent}%</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Finance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Today's Collection" value={`₹${data.finance.todayCollection.toLocaleString()}`} icon={IndianRupee} />
          <StatCard title="Total Collected" value={`₹${data.finance.totalPaid.toLocaleString()}`} icon={IndianRupee} accent="green" />
          <StatCard title="Outstanding" value={`₹${data.finance.outstanding.toLocaleString()}`} icon={IndianRupee} accent="amber" />
          <StatCard title="Defaulters" value={String(data.finance.defaulterCount)} icon={IndianRupee} accent="red" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Academics</h2>
        <Card>
          <CardHeader><CardTitle className="text-base">Top Performers</CardTitle></CardHeader>
          <CardContent>
            {data.academics.topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No report cards published yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.academics.topPerformers.map((s, i) => (
                  <li key={i} className="flex justify-between rounded border p-2">
                    <span>{s.name}</span>
                    <span>{s.percentage.toFixed(1)}% · Grade {s.grade}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <StatCard title="Total Staff" value={String(data.staff.total)} icon={Award} />
    </div>
  );
}
