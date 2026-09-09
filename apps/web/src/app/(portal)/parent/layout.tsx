'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { isParent, normalizeRoles } from '@/lib/roles';
import { schoolApi } from '@/lib/api';
import { PortalLayoutShell } from '@/components/portal/portal-layout-shell';
import type { ParentChildData } from '@/components/portal/erp-types';

type ParentDashboard = { children: ParentChildData[] };

export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, accessToken, _hasHydrated } = useAuthStore();
  const roles = normalizeRoles(user?.roles);
  const parentUser = isParent(roles);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!parentUser) router.replace('/student');
  }, [_hasHydrated, isAuthenticated, parentUser, router]);

  const { data } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => schoolApi.parentDashboard(accessToken!) as Promise<ParentDashboard>,
    enabled: !!accessToken && parentUser,
  });

  const child = data?.children[0];
  const pendingHw = child?.pendingHomework ?? 0;
  const unpaidFees = child?.fees.invoices.filter((i) => i.status !== 'PAID').length ?? 0;
  const liveClasses = child
    ? child.liveClasses.live.length + child.liveClasses.upcoming.length
    : 0;

  if (!_hasHydrated || !parentUser) return null;

  const subtitle = child ? `Tracking ${child.name}` : undefined;

  return (
    <PortalLayoutShell badges={{ pendingHw, unpaidFees, liveClasses }} subtitle={subtitle}>
      {children}
    </PortalLayoutShell>
  );
}
