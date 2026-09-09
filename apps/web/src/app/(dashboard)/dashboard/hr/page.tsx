'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/layout/data-table';
import { schoolErpApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { Users } from 'lucide-react';

function asList<T>(v: unknown): T[] { return Array.isArray(v) ? v : []; }

export default function HrDashboard() {
  const { accessToken } = useRequireAuth();

  const { data: staffRaw } = useQuery({
    queryKey: ['erp-staff'],
    queryFn: () => schoolErpApi.listStaff(accessToken!) as Promise<unknown[]>,
    enabled: !!accessToken,
  });

  const { data: leaveRaw } = useQuery({
    queryKey: ['erp-leave'],
    queryFn: () => schoolErpApi.listLeave(accessToken!, 'PENDING') as Promise<unknown[]>,
    enabled: !!accessToken,
  });

  const { data: departmentsRaw } = useQuery({
    queryKey: ['erp-departments'],
    queryFn: () => schoolErpApi.listDepartments(accessToken!) as Promise<unknown[]>,
    enabled: !!accessToken,
  });

  const staff = asList<Record<string, unknown>>(staffRaw);
  const leave = asList<Record<string, unknown>>(leaveRaw);
  const departments = asList<Record<string, unknown>>(departmentsRaw);

  return (
    <div className="space-y-6">
      <PageHeader title="HR Dashboard" description="Staff profiles, leave management, and departments." badge="HR" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Staff" value={String(staff.length)} icon={Users} />
        <StatCard title="Pending Leave" value={String(leave.length)} icon={Users} accent="amber" />
        <StatCard title="Departments" value={String(departments.length)} icon={Users} accent="violet" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Staff</CardTitle></CardHeader>
          <CardContent>
            {staff.length === 0 ? <EmptyState title="No staff" icon={Users} /> : (
              <ul className="space-y-2">
                {staff.slice(0, 10).map((s) => {
                  const u = s.user as Record<string, string>;
                  return (
                    <li key={String(s.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{u ? `${u.firstName} ${u.lastName}` : 'Staff'}</p>
                        <p className="text-muted-foreground">{String(s.designation ?? '—')} · {String(s.department ?? '—')}</p>
                      </div>
                      <span className="font-mono text-xs">{String(s.employeeId)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pending Leave Applications</CardTitle></CardHeader>
          <CardContent>
            {leave.length === 0 ? <EmptyState title="No pending leave" icon={Users} /> : (
              <ul className="space-y-2">
                {leave.map((l) => {
                  const st = l.staff as Record<string, Record<string, string>>;
                  return (
                    <li key={String(l.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{st?.user ? `${st.user.firstName} ${st.user.lastName}` : 'Staff'}</p>
                        <p className="text-muted-foreground">{String(l.leaveType)} · {String(l.startDate).slice(0, 10)} – {String(l.endDate).slice(0, 10)}</p>
                      </div>
                      <Badge>{String(l.status)}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
