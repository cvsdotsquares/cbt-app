'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Moon, Sun, LogOut, Bell, ChevronRight, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { authApi, isAdmin } from '@/lib/api';
import { normalizeRoles } from '@/lib/roles';
import { useLiveNotifications } from '@/hooks/use-live-notifications';
import { useNotificationStore } from '@/stores/notification-store';
import { MobileNav } from './mobile-nav';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Institute Home',
  '/dashboard/materials': 'NCERT Books',
  '/dashboard/batches': 'Classes & Batches',
  '/dashboard/syllabus': 'Syllabus',
  '/dashboard/ai-tests': 'Create Class Test',
  '/dashboard/exams': 'Class Tests',
  '/dashboard/candidates': 'Students',
  '/dashboard/results': 'Results',
  '/dashboard/teacher': 'My Classes',
  '/dashboard/questions': 'Question Bank',
  '/dashboard/users': 'Staff & Teachers',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/monitoring': 'Live Monitoring',
  '/dashboard/ai': 'AI Studio',
  '/dashboard/audit': 'Audit Logs',
  '/dashboard/settings': 'Institute Settings',
  '/dashboard/institutes': 'Institutes',
};

export function Header() {
  const { user, logout, accessToken } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useLiveNotifications();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const pageTitle = pageTitles[pathname] || 'Institute';
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
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-3 backdrop-blur-xl sm:h-[72px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <span>Institute</span>
              <ChevronRight className="h-3 w-3" />
              <span className="truncate font-medium text-foreground">{pageTitle}</span>
            </div>
            <h2 className="truncate text-base font-bold tracking-tight sm:text-xl">{pageTitle}</h2>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="mr-1 hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 md:flex">
            <span className="status-dot scale-75" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">System Online</span>
          </div>

          <div className="relative" ref={panelRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNotifications((v) => !v)}
              title="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {showNotifications && (
              <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount > 0 && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`flex w-full flex-col gap-0.5 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${!n.read ? 'bg-primary/5' : ''}`}
                        onClick={() => markRead(n.id)}
                      >
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="text-xs text-muted-foreground">{n.message}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(n.timestamp).toLocaleString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>

          <div className="mx-1 hidden h-8 w-px bg-border sm:mx-2 sm:block" />

          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 py-1 pl-1 pr-2 sm:gap-3 sm:py-1.5 sm:pr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-white shadow-sm">
              {initials || 'U'}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-semibold leading-none">{user?.firstName} {user?.lastName}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{user?.roles?.[0]?.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {!isAdmin(normalizeRoles(user?.roles)) && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => router.push('/my-exams')}
            >
              Student Portal
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={handleLogout} title="Logout">
            <LogOut className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  );
}
