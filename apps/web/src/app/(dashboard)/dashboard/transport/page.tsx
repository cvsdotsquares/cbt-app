'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/layout/data-table';
import { schoolErpApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { Bus } from 'lucide-react';

function asList<T>(v: unknown): T[] { return Array.isArray(v) ? v : []; }

export default function TransportDashboard() {
  const { accessToken } = useRequireAuth();

  const { data: routesRaw } = useQuery({
    queryKey: ['erp-transport'],
    queryFn: () => schoolErpApi.listTransportRoutes(accessToken!) as Promise<unknown[]>,
    enabled: !!accessToken,
  });

  const { data: vehiclesRaw } = useQuery({
    queryKey: ['erp-vehicles'],
    queryFn: () => schoolErpApi.listVehicles(accessToken!) as Promise<unknown[]>,
    enabled: !!accessToken,
  });

  const routes = asList<Record<string, unknown>>(routesRaw);
  const vehicles = asList<Record<string, unknown>>(vehiclesRaw);

  const totalStudents = routes.reduce((s, r) => s + Number((r._count as Record<string, number>)?.assignments ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Transport Dashboard" description="Routes, vehicles, and student assignments." badge="Transport" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Active Routes" value={String(routes.length)} icon={Bus} />
        <StatCard title="Vehicles" value={String(vehicles.length)} icon={Bus} accent="green" />
        <StatCard title="Students on Transport" value={String(totalStudents)} icon={Bus} accent="violet" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Routes</CardTitle></CardHeader>
          <CardContent>
            {routes.length === 0 ? <EmptyState title="No routes" icon={Bus} /> : (
              <ul className="space-y-2">
                {routes.map((r) => (
                  <li key={String(r.id)} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{String(r.name)} ({String(r.code)})</p>
                    <p className="text-muted-foreground">{String(r.startPoint)} → {String(r.endPoint)}</p>
                    <p className="text-muted-foreground">₹{Number(r.monthlyFee).toLocaleString()}/mo · {String((r._count as Record<string, number>)?.assignments ?? 0)} students</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vehicles</CardTitle></CardHeader>
          <CardContent>
            {vehicles.length === 0 ? <EmptyState title="No vehicles" icon={Bus} /> : (
              <ul className="space-y-2">
                {vehicles.map((v) => (
                  <li key={String(v.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{String(v.registration)}</p>
                      <p className="text-muted-foreground">{String(v.driverName ?? 'No driver')} · Cap {String(v.capacity)}</p>
                    </div>
                    <Badge variant="outline">{v.isActive ? 'Active' : 'Inactive'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
