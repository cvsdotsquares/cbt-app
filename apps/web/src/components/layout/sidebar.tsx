'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Upload, Sparkles, Award, Settings, UserCog, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { Logo } from './logo';

/** Simple primary nav — everything else lives under Settings or direct links from Home */
const mainNav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, permission: Permission.ANALYTICS_VIEW, exact: true },
  { href: '/dashboard/ai-tests', label: 'Create Test', icon: Sparkles, permission: Permission.AI_GENERATE_TEST },
  { href: '/dashboard/exams', label: 'Exams', icon: ClipboardList, permission: Permission.EXAM_READ },
  { href: '/dashboard/batches', label: 'Classes & Batches', icon: Users, permission: Permission.BATCH_READ },
  { href: '/dashboard/materials', label: 'Books & Notes', icon: Upload, permission: Permission.MATERIAL_READ },
  { href: '/dashboard/candidates', label: 'Students', icon: Users, permission: Permission.CANDIDATE_READ },
  { href: '/dashboard/results', label: 'Results', icon: Award, permission: Permission.RESULT_READ },
];

const settingsNav = [
  { href: '/dashboard/users', label: 'Staff & Teachers', icon: UserCog, permission: Permission.USER_READ },
  { href: '/dashboard/settings', label: 'Institute Settings', icon: Settings, permission: Permission.TENANT_READ },
];

export function Sidebar() {
  const pathname = usePathname();
  const { can } = usePermissions();

  const renderLink = (item: typeof mainNav[0]) => {
    const Icon = item.icon;
    const isActive = item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-sidebar-accent text-white nav-active-glow'
            : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground',
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/90" />
        )}
        <Icon className={cn(
          'h-[18px] w-[18px] shrink-0',
          isActive ? 'text-white' : 'text-sidebar-muted group-hover:text-sidebar-foreground',
        )} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="relative flex h-full w-[260px] flex-col bg-sidebar text-sidebar-foreground shadow-sidebar">
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-sidebar-border to-transparent" />

      <div className="flex h-[72px] items-center border-b border-sidebar-border px-6">
        <Logo variant="light" />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        <div className="space-y-1">
          {mainNav.filter((i) => can(i.permission)).map(renderLink)}
        </div>

        {settingsNav.some((i) => can(i.permission)) && (
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-muted/80">
              Settings
            </p>
            <div className="space-y-1">
              {settingsNav.filter((i) => can(i.permission)).map(renderLink)}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-center text-[11px] text-sidebar-muted">
          NCERT · Classes 9–12
        </p>
      </div>
    </aside>
  );
}
