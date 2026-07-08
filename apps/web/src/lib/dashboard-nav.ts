import { Permission } from '@cbt/shared';

export interface DashboardRoute {
  path: string;
  permission: Permission;
  exact?: boolean;
}

export const DASHBOARD_ROUTES: DashboardRoute[] = [
  { path: '/dashboard/guide', permission: Permission.TENANT_READ },
  { path: '/dashboard', permission: Permission.ANALYTICS_VIEW, exact: true },
  { path: '/dashboard/analytics', permission: Permission.ANALYTICS_VIEW },
  { path: '/dashboard/teacher', permission: Permission.LEARNING_MANAGE },
  { path: '/dashboard/syllabus', permission: Permission.CURRICULUM_READ },
  { path: '/dashboard/batches', permission: Permission.BATCH_READ },
  { path: '/dashboard/materials', permission: Permission.MATERIAL_READ },
  { path: '/dashboard/ai-tests', permission: Permission.AI_GENERATE_TEST },
  { path: '/dashboard/institutes', permission: Permission.TENANT_CREATE },
  { path: '/dashboard/exams', permission: Permission.EXAM_READ },
  { path: '/dashboard/ai', permission: Permission.QUESTION_CREATE },
  { path: '/dashboard/questions', permission: Permission.QUESTION_READ },
  { path: '/dashboard/results', permission: Permission.RESULT_READ },
  { path: '/dashboard/candidates', permission: Permission.CANDIDATE_READ },
  { path: '/dashboard/users', permission: Permission.USER_READ },
  { path: '/dashboard/monitoring', permission: Permission.PROCTORING_MONITOR },
  { path: '/dashboard/audit', permission: Permission.AUDIT_READ },
  { path: '/dashboard/settings', permission: Permission.TENANT_READ },
];

export function getPermissionForPath(pathname: string): Permission | null {
  if (pathname === '/dashboard') {
    return Permission.ANALYTICS_VIEW;
  }
  const match = DASHBOARD_ROUTES.find(
    (route) => route.path !== '/dashboard' && pathname.startsWith(route.path),
  );
  return match?.permission ?? null;
}

export function getDefaultDashboardPath(
  can: (permission: Permission | string) => boolean,
): string {
  for (const route of DASHBOARD_ROUTES) {
    if (can(route.permission)) return route.path;
  }
  return '/my-exams';
}
