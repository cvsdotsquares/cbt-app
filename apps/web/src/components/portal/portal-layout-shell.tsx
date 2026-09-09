'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PortalSidebar } from '@/components/portal/portal-sidebar';
import { PortalHeader } from '@/components/portal/portal-header';
import { getPortalTheme, type PortalVariant } from '@/components/portal/portal-theme';

type PortalLayoutShellProps = {
  children: React.ReactNode;
  badges?: Partial<Record<'liveClasses' | 'pendingHw' | 'unpaidFees', number>>;
  subtitle?: string;
};

export function PortalLayoutShell({ children, badges, subtitle }: PortalLayoutShellProps) {
  const pathname = usePathname();
  const variant: PortalVariant = pathname.startsWith('/parent') ? 'parent' : 'student';
  const theme = getPortalTheme(variant);

  return (
    <div className={cn('flex h-dvh', theme.bgClass)}>
      <div className="hidden lg:block">
        <PortalSidebar variant={variant} badges={badges} subtitle={subtitle} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PortalHeader variant={variant} badges={badges} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="page-shell mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
