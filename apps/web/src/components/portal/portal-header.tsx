'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Moon, Sun, LogOut, Menu, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/api';
import { PortalMobileNav } from '@/components/portal/portal-mobile-nav';
import { parentPageTitles, studentPageTitles } from '@/components/portal/portal-nav';
import { getPortalTheme, type PortalVariant } from '@/components/portal/portal-theme';
import { cn } from '@/lib/utils';

type PortalHeaderProps = {
  variant: PortalVariant;
  badges?: Partial<Record<'liveClasses' | 'pendingHw' | 'unpaidFees', number>>;
  subtitle?: string;
};

export function PortalHeader({ variant, badges, subtitle }: PortalHeaderProps) {
  const { user, logout, accessToken } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const themeConfig = getPortalTheme(variant);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const titles = variant === 'student' ? studentPageTitles : parentPageTitles;
  const pageTitle = titles[pathname] ?? themeConfig.portalTitle;
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  async function handleLogout() {
    if (accessToken) {
      try { await authApi.logout(accessToken); } catch { /* ignore */ }
    }
    await logout();
    window.location.href = '/login';
  }

  return (
    <>
      <header className={cn(
        'sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3 backdrop-blur-xl sm:h-[72px] sm:px-6 lg:px-8',
        themeConfig.headerAccentClass,
      )}>
        <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80', themeConfig.gradientFrom, themeConfig.gradientTo)} />

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <span className={cn('font-semibold bg-gradient-to-r bg-clip-text text-transparent', themeConfig.gradientFrom, themeConfig.gradientTo)}>
                {themeConfig.portalTitle}
              </span>
              <ChevronRight className="h-3 w-3" />
              <span className="truncate font-medium text-foreground">{pageTitle}</span>
            </div>
            <h2 className="truncate text-base font-bold tracking-tight sm:text-xl">{pageTitle}</h2>
            {subtitle && <p className="hidden truncate text-xs text-muted-foreground md:block">{subtitle}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>

          <div className="mx-1 hidden h-8 w-px bg-border sm:block" />

          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 py-1 pl-1 pr-2 sm:gap-3 sm:py-1.5 sm:pr-4">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm', themeConfig.avatarClass)}>
              {initials || 'U'}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-semibold leading-none">{user?.firstName} {user?.lastName}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{themeConfig.tagline}</p>
            </div>
          </div>

          {variant === 'student' && (
            <Button
              size="sm"
              className={cn('hidden sm:inline-flex border-0 text-white shadow-sm', themeConfig.avatarClass)}
              onClick={() => router.push('/student/school')}
            >
              My School
            </Button>
          )}

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={handleLogout} title="Logout">
            <LogOut className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </header>

      <PortalMobileNav variant={variant} open={mobileOpen} onOpenChange={setMobileOpen} badges={badges} subtitle={subtitle} />
    </>
  );
}
