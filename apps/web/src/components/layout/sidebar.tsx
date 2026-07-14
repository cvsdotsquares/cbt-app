'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Upload, Sparkles, Award, Settings, UserCog, ClipboardList,
  BookOpen, School, CircleHelp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { Logo } from './logo';
import { useAuthStore } from '@/stores/auth-store';
import { isTeacherOnly, normalizeRoles } from '@/lib/roles';

/** NCERT institute workflow — books → classes → syllabus → tests → students → results */
export const mainNav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, permission: Permission.ANALYTICS_VIEW, exact: true },
  { href: '/dashboard/materials', label: 'NCERT Books', icon: Upload, permission: Permission.MATERIAL_READ },
  { href: '/dashboard/batches', label: 'Classes & Batches', icon: School, permission: Permission.BATCH_READ },
  { href: '/dashboard/syllabus', label: 'Syllabus', icon: BookOpen, permission: Permission.CURRICULUM_READ },
  { href: '/dashboard/ai-tests', label: 'Create Class Test', icon: Sparkles, permission: Permission.AI_GENERATE_TEST },
  { href: '/dashboard/exams', label: 'Class Tests', icon: ClipboardList, permission: Permission.EXAM_READ },
  { href: '/dashboard/candidates', label: 'Students', icon: Users, permission: Permission.CANDIDATE_READ },
  { href: '/dashboard/results', label: 'Results', icon: Award, permission: Permission.RESULT_READ },
];

/** Simplified teacher-only portal — books live inside Syllabus per subject */
export const teacherNav = [
  { href: '/dashboard/teacher', label: 'Home', icon: LayoutDashboard, permission: Permission.LEARNING_MANAGE, exact: true },
  { href: '/dashboard/syllabus', label: 'Syllabus', icon: BookOpen, permission: Permission.CURRICULUM_READ },
  { href: '/dashboard/batches', label: 'Topic Progress', icon: School, permission: Permission.SYLLABUS_READ },
  { href: '/dashboard/ai-tests', label: 'Create Class Test', icon: Sparkles, permission: Permission.AI_GENERATE_TEST },
  { href: '/dashboard/exams', label: 'Class Tests', icon: ClipboardList, permission: Permission.EXAM_READ },
  { href: '/dashboard/candidates', label: 'My Students', icon: Users, permission: Permission.CANDIDATE_READ },
  { href: '/dashboard/results', label: 'Results', icon: Award, permission: Permission.RESULT_READ },
];

export const settingsNav = [
  { href: '/dashboard/users', label: 'Staff & Teachers', icon: UserCog, permission: Permission.USER_READ },
  { href: '/dashboard/settings', label: 'Institute Settings', icon: Settings, permission: Permission.TENANT_READ },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { user } = useAuthStore();
  const teacherPortal = isTeacherOnly(normalizeRoles(user?.roles));
  const nav = teacherPortal ? teacherNav : mainNav;
  const showSettings = !teacherPortal && settingsNav.some((i) => can(i.permission));

  const renderLink = (item: {
    href: string;
    label: string;
    icon: typeof CircleHelp;
    exact?: boolean;
  }) => {
    const Icon = item.icon;
    const isActive = item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
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
    <aside
      className={cn(
        'relative flex h-full w-[min(260px,85vw)] flex-col bg-sidebar text-sidebar-foreground shadow-sidebar',
        className,
      )}
    >
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-sidebar-border to-transparent" />

      <div className="flex h-[64px] items-center border-b border-sidebar-border px-5 sm:h-[72px] sm:px-6">
        <Logo variant="light" />
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-5 sm:py-6">
        <div className="flex-1 space-y-6">
          <div className="space-y-1">
            {nav.filter((i) => can(i.permission)).map(renderLink)}
          </div>

          {showSettings && (
            <div>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-muted/80">
                Settings
              </p>
              <div className="space-y-1">
                {settingsNav.filter((i) => can(i.permission)).map(renderLink)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-1 border-t border-sidebar-border pt-3">
          {renderLink({
            href: '/dashboard/guide',
            label: 'Help & Guide',
            icon: CircleHelp,
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-center text-[11px] text-sidebar-muted">
          {teacherPortal ? 'Teacher portal · Assigned subjects' : 'NCERT · Classes 9–12'}
        </p>
      </div>
    </aside>
  );
}
