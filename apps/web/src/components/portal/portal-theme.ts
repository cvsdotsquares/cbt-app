import { GraduationCap, HeartHandshake, type LucideIcon } from 'lucide-react';

export type PortalVariant = 'student' | 'parent';

export type PortalTheme = {
  accentHsl: string;
  accentSecondaryHsl: string;
  bgClass: string;
  sidebarClass: string;
  heroClass: string;
  glowClass: string;
  gradientFrom: string;
  gradientTo: string;
  badgeClass: string;
  headerAccentClass: string;
  avatarClass: string;
  icon: LucideIcon;
  portalTitle: string;
  tagline: string;
  footer: string;
};

export const portalThemes: Record<PortalVariant, PortalTheme> = {
  student: {
    accentHsl: '239 84% 67%',
    accentSecondaryHsl: '262 83% 58%',
    bgClass: 'portal-student-bg',
    sidebarClass: 'portal-sidebar-student',
    heroClass: 'hero-banner-student',
    glowClass: 'nav-active-glow-student',
    gradientFrom: 'from-indigo-500',
    gradientTo: 'to-violet-500',
    badgeClass: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    headerAccentClass: 'portal-header-student',
    avatarClass: 'bg-gradient-to-br from-indigo-500 to-violet-600',
    icon: GraduationCap,
    portalTitle: 'Student Portal',
    tagline: 'Learn · Test · Grow',
    footer: 'NCERT-aligned · Classes 9–12',
  },
  parent: {
    accentHsl: '160 84% 39%',
    accentSecondaryHsl: '172 66% 40%',
    bgClass: 'portal-parent-bg',
    sidebarClass: 'portal-sidebar-parent',
    heroClass: 'hero-banner-parent',
    glowClass: 'nav-active-glow-parent',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-500',
    badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    headerAccentClass: 'portal-header-parent',
    avatarClass: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    icon: HeartHandshake,
    portalTitle: 'Parent Portal',
    tagline: 'Track · Support · Connect',
    footer: 'School ERP · Family dashboard',
  },
};

export function getPortalTheme(variant: PortalVariant) {
  return portalThemes[variant];
}
