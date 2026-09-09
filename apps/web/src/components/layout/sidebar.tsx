'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Upload, Sparkles, Award, Settings, UserCog, ClipboardList,
  BookOpen, School, CircleHelp, CalendarDays, UserCheck, NotebookPen, Megaphone, Video,
  Building2, Bus, FileText, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { Logo } from './logo';
import { useAuthStore } from '@/stores/auth-store';
import { isTeacherOnly, normalizeRoles, getRolePortalHome } from '@/lib/roles';

/** School management — daily operations + academic workflow */
/** Full school ERP — admissions, fees, HR, transport, etc. */
export const schoolAdminNav = [
  { href: '/dashboard/school-admin', label: 'School Admin', icon: Building2, permission: Permission.ADMISSION_READ },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, permission: Permission.ANALYTICS_VIEW },
  { href: '/dashboard/certificates', label: 'Certificates', icon: FileText, permission: Permission.CERTIFICATE_READ },
];

export const roleNav = [
  { href: '/dashboard/accountant', label: 'Finance', icon: Building2, permission: Permission.FEE_READ },
  { href: '/dashboard/librarian', label: 'Library', icon: BookOpen, permission: Permission.LIBRARY_READ },
  { href: '/dashboard/transport', label: 'Transport', icon: Bus, permission: Permission.TRANSPORT_READ },
  { href: '/dashboard/hr', label: 'HR', icon: UserCog, permission: Permission.HR_READ },
  { href: '/dashboard/driver', label: 'My Route', icon: Bus, permission: Permission.TRANSPORT_READ },
];

export const schoolOpsNav = [
  { href: '/dashboard/live-classes', label: 'Live Classes', icon: Video, permission: Permission.LIVE_CLASS_READ },
  { href: '/dashboard/timetable', label: 'Timetable', icon: CalendarDays, permission: Permission.TIMETABLE_READ },
  { href: '/dashboard/attendance', label: 'Attendance', icon: UserCheck, permission: Permission.ATTENDANCE_READ },
  { href: '/dashboard/homework', label: 'Homework', icon: NotebookPen, permission: Permission.HOMEWORK_READ },
  { href: '/dashboard/notices', label: 'Notices', icon: Megaphone, permission: Permission.NOTICE_READ },
];

export const mainNav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, permission: Permission.ANALYTICS_VIEW, exact: true },
  { href: '/dashboard/batches', label: 'Classes & Sections', icon: School, permission: Permission.BATCH_READ },
  { href: '/dashboard/candidates', label: 'Students', icon: Users, permission: Permission.CANDIDATE_READ },
  { href: '/dashboard/syllabus', label: 'Syllabus', icon: BookOpen, permission: Permission.CURRICULUM_READ },
  { href: '/dashboard/materials', label: 'Study Materials', icon: Upload, permission: Permission.MATERIAL_READ },
  { href: '/dashboard/ai-tests', label: 'Create Test', icon: Sparkles, permission: Permission.AI_GENERATE_TEST },
  { href: '/dashboard/exams', label: 'Exams & Tests', icon: ClipboardList, permission: Permission.EXAM_READ },
  { href: '/dashboard/results', label: 'Results', icon: Award, permission: Permission.RESULT_READ },
];

/** Simplified teacher-only portal — books live inside Syllabus per subject */
export const teacherNav = [
  { href: '/dashboard/teacher', label: 'Home', icon: LayoutDashboard, permission: Permission.LEARNING_MANAGE, exact: true },
  { href: '/dashboard/live-classes', label: 'Live Classes', icon: Video, permission: Permission.LIVE_CLASS_READ },
  { href: '/dashboard/attendance', label: 'Attendance', icon: UserCheck, permission: Permission.ATTENDANCE_READ },
  { href: '/dashboard/homework', label: 'Homework', icon: NotebookPen, permission: Permission.HOMEWORK_READ },
  { href: '/dashboard/timetable', label: 'Timetable', icon: CalendarDays, permission: Permission.TIMETABLE_READ },
  { href: '/dashboard/batches', label: 'Classes & Progress', icon: School, permission: Permission.SYLLABUS_READ },
  { href: '/dashboard/syllabus', label: 'Syllabus', icon: BookOpen, permission: Permission.CURRICULUM_READ },
  { href: '/dashboard/ai-tests', label: 'Create Test', icon: Sparkles, permission: Permission.AI_GENERATE_TEST },
  { href: '/dashboard/exams', label: 'Exams', icon: ClipboardList, permission: Permission.EXAM_READ },
  { href: '/dashboard/candidates', label: 'My Students', icon: Users, permission: Permission.CANDIDATE_READ },
  { href: '/dashboard/results', label: 'Results', icon: Award, permission: Permission.RESULT_READ },
  { href: '/dashboard/notices', label: 'Notices', icon: Megaphone, permission: Permission.NOTICE_READ },
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
  const roles = normalizeRoles(user?.roles);
  const teacherPortal = isTeacherOnly(roles);
  const rolePortal = getRolePortalHome(roles);
  const nav = teacherPortal ? teacherNav : mainNav;
  const showSettings = !teacherPortal && !rolePortal && settingsNav.some((i) => can(i.permission));
  const visibleRoleNav = rolePortal ? roleNav.filter((i) => i.href === rolePortal && can(i.permission)) : [];

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
          {visibleRoleNav.length > 0 && (
            <div>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-muted/80">
                My Portal
              </p>
              <div className="space-y-1">{visibleRoleNav.map(renderLink)}</div>
            </div>
          )}

          {!teacherPortal && !rolePortal && schoolAdminNav.some((i) => can(i.permission)) && (
            <div>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-muted/80">
                School ERP
              </p>
              <div className="space-y-1">
                {schoolAdminNav.filter((i) => can(i.permission)).map(renderLink)}
              </div>
            </div>
          )}

          {!teacherPortal && !rolePortal && schoolOpsNav.some((i) => can(i.permission)) && (
            <div>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-muted/80">
                Daily Operations
              </p>
              <div className="space-y-1">
                {schoolOpsNav.filter((i) => can(i.permission)).map(renderLink)}
              </div>
            </div>
          )}

          <div>
            {!teacherPortal && !rolePortal && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-muted/80">
                {teacherPortal ? 'Teaching' : 'Academic'}
              </p>
            )}
            <div className="space-y-1">
              {!rolePortal && nav.filter((i) => can(i.permission)).map(renderLink)}
            </div>
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
