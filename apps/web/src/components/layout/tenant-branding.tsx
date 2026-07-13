'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { tenantsApi } from '@/lib/api';
import { applyTenantPrimaryColor } from '@/lib/tenant-branding';
import { Permission } from '@cbt/shared';
import { usePermissions } from '@/hooks/use-permissions';

type TenantBrandingData = {
  branding?: { primaryColor?: string };
};

/** Loads tenant branding and applies primary color across the dashboard. */
export function TenantBranding() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const { can } = usePermissions();
  const canReadTenant = can(Permission.TENANT_READ);

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantsApi.get(accessToken!, tenantId!) as Promise<TenantBrandingData>,
    enabled: !!accessToken && !!tenantId && canReadTenant,
  });

  useEffect(() => {
    applyTenantPrimaryColor(tenant?.branding?.primaryColor);
  }, [tenant?.branding?.primaryColor]);

  return null;
}
