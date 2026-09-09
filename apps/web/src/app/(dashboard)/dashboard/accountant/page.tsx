'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { schoolErpApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { IndianRupee, AlertTriangle, Bell } from 'lucide-react';

function asList<T>(v: unknown): T[] { return Array.isArray(v) ? v : []; }

export default function AccountantDashboard() {
  const { accessToken } = useRequireAuth();
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['erp-fee-summary'],
    queryFn: () => schoolErpApi.feeSummary(accessToken!) as Promise<Record<string, number>>,
    enabled: !!accessToken,
  });

  const { data: defaultersRaw } = useQuery({
    queryKey: ['erp-defaulters'],
    queryFn: () => schoolErpApi.listDefaulters(accessToken!) as Promise<unknown[]>,
    enabled: !!accessToken,
  });

  const { data: collection } = useQuery({
    queryKey: ['erp-daily-collection'],
    queryFn: () => schoolErpApi.dailyCollection(accessToken!) as Promise<{ total: number; count: number }>,
    enabled: !!accessToken,
  });

  const defaulters = asList<Record<string, unknown>>(defaultersRaw);

  const remindMutation = useMutation({
    mutationFn: () => schoolErpApi.notifyFeeDefaulters(accessToken!) as Promise<{ notified?: number }>,
    onSuccess: (r) => {
      toast({ title: 'Reminders sent', description: `${r.notified ?? 0} parents notified.` });
      qc.invalidateQueries({ queryKey: ['erp-notifications'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Accountant Dashboard" description="Fee collection, dues, and daily financial reports." badge="Finance" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's Collection" value={`₹${(collection?.total ?? 0).toLocaleString()}`} icon={IndianRupee} />
        <StatCard title="Total Collected" value={`₹${(summary?.totalPaid ?? 0).toLocaleString()}`} icon={IndianRupee} accent="green" />
        <StatCard title="Outstanding" value={`₹${(summary?.outstanding ?? 0).toLocaleString()}`} icon={IndianRupee} accent="amber" />
        <StatCard title="Overdue Invoices" value={String(summary?.overdueCount ?? 0)} icon={AlertTriangle} accent="red" />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => remindMutation.mutate()} disabled={remindMutation.isPending}>
          <Bell className="mr-2 h-4 w-4" /> Send Fee Reminders
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Fee Defaulters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {defaulters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overdue invoices.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Invoice</th><th className="p-2">Student</th><th className="p-2">Due Date</th><th className="p-2">Status</th></tr></thead>
                <tbody>
                  {defaulters.map((inv) => {
                    const c = inv.candidate as Record<string, Record<string, string>>;
                    return (
                      <tr key={String(inv.id)} className="border-b">
                        <td className="p-2 font-mono text-xs">{String(inv.invoiceNo)}</td>
                        <td className="p-2">{c?.user ? `${c.user.firstName} ${c.user.lastName}` : '—'}</td>
                        <td className="p-2">{String(inv.dueDate).slice(0, 10)}</td>
                        <td className="p-2"><Badge variant="destructive">{String(inv.status)}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
