'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { isAdmin, normalizeRoles } from '@/lib/roles';
import { schoolApi } from '@/lib/api';
import { PortalLayoutShell } from '@/components/portal/portal-layout-shell';
import type { StudentSchoolData } from '@/components/portal/erp-types';

export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, accessToken, _hasHydrated } = useAuthStore();
  const roles = normalizeRoles(user?.roles);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace('/login');
    else if (user && isAdmin(roles)) router.replace('/dashboard');
  }, [_hasHydrated, isAuthenticated, user, roles, router]);

  const { data: school } = useQuery({
    queryKey: ['student-school'],
    queryFn: () => schoolApi.studentDashboard(accessToken!) as Promise<StudentSchoolData>,
    enabled: !!accessToken && _hasHydrated && !isAdmin(roles),
  });

  const pendingHw = school?.homeworks?.filter((h) => !h.mySubmission).length ?? 0;
  const liveClasses = (school?.liveClasses?.live.length ?? 0) + (school?.liveClasses?.upcoming.length ?? 0);

  if (!_hasHydrated || !isAuthenticated || !user || isAdmin(roles)) return null;

  const subtitle = school?.batch
    ? `${school.batch.className} · ${school.batch.name}`
    : undefined;

  return (
    <PortalLayoutShell badges={{ liveClasses, pendingHw }} subtitle={subtitle}>
      {children}
    </PortalLayoutShell>
  );
}
