'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { schoolErpApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { Bus, MapPin } from 'lucide-react';

export default function DriverDashboard() {
  const { accessToken } = useRequireAuth();
  const [phone, setPhone] = useState('');

  const { data: route, refetch, isFetching } = useQuery({
    queryKey: ['driver-route', phone],
    queryFn: () => schoolErpApi.driverRoute(accessToken!, phone) as Promise<Record<string, unknown>>,
    enabled: !!accessToken && phone.length >= 10,
    retry: false,
  });

  const routeData = route?.route as Record<string, unknown> | undefined;
  const stops = (routeData?.stops as Record<string, unknown>[]) ?? [];
  const assignments = (routeData?.assignments as Record<string, unknown>[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Driver Portal" description="View your assigned route and student pickup list." badge="Driver" />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="flex-1">
            <Label>Your Phone Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Registered driver phone" />
          </div>
          <Button onClick={() => refetch()} disabled={isFetching}>Load Route</Button>
        </CardContent>
      </Card>

      {route && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bus className="h-4 w-4" /> {String(routeData?.name ?? 'Route')} ({String(route.registration)})
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {String(routeData?.startPoint)} → {String(routeData?.endPoint)} · Capacity: {String(route.capacity)}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Stops</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {stops.map((s) => (
                    <li key={String(s.id)} className="flex justify-between rounded border p-2">
                      <span>{String(s.sequence)}. {String(s.name)}</span>
                      <span className="text-muted-foreground">{String(s.pickUpTime ?? '—')}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Students ({assignments.length})</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {assignments.map((a) => {
                    const c = a.candidate as Record<string, Record<string, string>>;
                    return (
                      <li key={String(a.candidateId)} className="rounded border p-2">
                        {c?.user ? `${c.user.firstName} ${c.user.lastName}` : 'Student'}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
