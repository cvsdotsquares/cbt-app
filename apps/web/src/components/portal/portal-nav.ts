import type { LucideIcon } from 'lucide-react';
import {
  Award, BookOpen, CircleHelp, FileText, GraduationCap,
  IndianRupee, LayoutDashboard, School, Video,
} from 'lucide-react';

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: 'liveClasses' | 'pendingHw' | 'unpaidFees';
};

export const studentNav: PortalNavItem[] = [
  { href: '/student', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/student/school', label: 'My School', icon: School, badgeKey: 'liveClasses' },
  { href: '/student/exams', label: 'Class Tests', icon: FileText },
  { href: '/student/results', label: 'Results', icon: Award },
  { href: '/student/progress', label: 'Syllabus', icon: BookOpen },
];

export const parentNav: PortalNavItem[] = [
  { href: '/parent', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/parent/academics', label: 'Academics', icon: BookOpen, badgeKey: 'pendingHw' },
  { href: '/parent/fees', label: 'Fees & Docs', icon: IndianRupee, badgeKey: 'unpaidFees' },
  { href: '/parent/life', label: 'School Life', icon: GraduationCap },
];

export const portalHelpNav = { href: '/help', label: 'Help & Guide', icon: CircleHelp };

export const studentPageTitles: Record<string, string> = {
  '/student': 'Student Home',
  '/student/school': 'My School',
  '/student/exams': 'Class Tests',
  '/student/results': 'Results',
  '/student/progress': 'Test Syllabus',
};

export const parentPageTitles: Record<string, string> = {
  '/parent': 'Parent Overview',
  '/parent/academics': 'Academics',
  '/parent/fees': 'Fees & Documents',
  '/parent/life': 'School Life',
};
