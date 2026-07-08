'use client';

import { useAuthStore } from '@/stores/auth-store';
import { isAdmin, normalizeRoles } from '@/lib/roles';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { AiAssistant } from '@/components/ai/ai-assistant';
import { usePermissions } from '@/hooks/use-permissions';
import { getDefaultDashboardPath, getPermissionForPath } from '@/lib/dashboard-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { can } = usePermissions();
  const roles = normalizeRoles(user?.roles);
  const staffUser = isAdmin(roles);

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }

    if (!staffUser) {
      router.replace('/my-exams');
      return;
    }

    const required = getPermissionForPath(pathname);
    if (required && !can(required)) {
      router.replace(getDefaultDashboardPath(can));
    }
  }, [_hasHydrated, isAuthenticated, user, staffUser, router, pathname, can]);

  if (!_hasHydrated) return null;
  if (!isAuthenticated || !user || !staffUser) return null;

  return (
    <div className="flex h-dvh mesh-bg">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="page-shell">{children}</div>
        </main>
        <AiAssistant />
      </div>
    </div>
  );
}
