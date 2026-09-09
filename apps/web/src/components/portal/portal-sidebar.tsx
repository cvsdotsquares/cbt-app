'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/logo';
import { Video } from 'lucide-react';
import {
  type PortalNavItem,
  parentNav,
  portalHelpNav,
  studentNav,
} from '@/components/portal/portal-nav';
import { getPortalTheme, type PortalVariant } from '@/components/portal/portal-theme';

type PortalSidebarProps = {
  variant: PortalVariant;
  className?: string;
  onNavigate?: () => void;
  badges?: Partial<Record<'liveClasses' | 'pendingHw' | 'unpaidFees', number>>;
  subtitle?: string;
};

export function PortalSidebar({ variant, className, onNavigate, badges, subtitle }: PortalSidebarProps) {
  const pathname = usePathname();
  const theme = getPortalTheme(variant);
  const nav = variant === 'student' ? studentNav : parentNav;
  const BrandIcon = theme.icon;

  const renderLink = (item: PortalNavItem) => {
    const Icon = item.icon;
    const isActive = item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
          isActive
            ? cn('bg-sidebar-accent text-white', theme.glowClass)
            : 'text-sidebar-muted hover:bg-white/[0.07] hover:text-sidebar-foreground',
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-white/90 shadow-sm" />
        )}
        <span className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          isActive ? 'bg-white/15' : 'bg-white/[0.04] group-hover:bg-white/[0.08]',
        )}>
          <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-sidebar-muted group-hover:text-sidebar-foreground')} />
        </span>
        <span className="flex-1">{item.label}</span>
        {badge != null && badge > 0 && (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            isActive ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-300',
          )}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    );
  };

  const HelpIcon = portalHelpNav.icon;

  return (
    <aside
      className={cn(
        'relative flex h-full w-[min(272px,88vw)] flex-col text-sidebar-foreground shadow-sidebar',
        theme.sidebarClass,
        className,
      )}
    >
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5 sm:py-5">
        <Logo variant="light" />
        <div className={cn(
          'mt-4 flex items-center gap-3 rounded-xl border p-3',
          variant === 'student' ? 'portal-sidebar-brand-student' : 'portal-sidebar-brand-parent',
        )}>
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md', theme.avatarClass)}>
            <BrandIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{theme.portalTitle}</p>
            <p className="truncate text-[11px] text-sidebar-muted">{subtitle ?? theme.tagline}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-4 sm:py-5">
        <div className="flex-1 space-y-5">
          <div>
            <p className="mb-2.5 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted/90">
              Navigation
            </p>
            <div className="space-y-1">{nav.map(renderLink)}</div>
          </div>

          {variant === 'student' && (badges?.liveClasses ?? 0) > 0 && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">Live now</p>
              <p className="mt-1 text-xs text-red-100/90">{badges!.liveClasses} class{badges!.liveClasses === 1 ? '' : 'es'} available</p>
              <Link
                href="/student/school"
                onClick={onNavigate}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:underline"
              >
                <Video className="h-3.5 w-3.5" /> Join class
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-1 border-t border-white/[0.06] pt-4">
          <Link
            href={portalHelpNav.href}
            onClick={onNavigate}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-muted transition-all hover:bg-white/[0.06] hover:text-sidebar-foreground"
          >
            <HelpIcon className="h-[18px] w-[18px] shrink-0" />
            {portalHelpNav.label}
          </Link>
        </div>
      </nav>

      <div className="border-t border-white/[0.06] p-4">
        <p className="text-center text-[11px] leading-relaxed text-sidebar-muted">{theme.footer}</p>
      </div>
    </aside>
  );
}
