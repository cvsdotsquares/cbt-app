import { authHeaders } from './api';
import { useAuthStore } from '@/stores/auth-store';

/** Fetch printable HTML document from school-erp and open in new window for print/PDF. */
export async function openSchoolDocument(path: string, accessToken: string): Promise<void> {
  const tenantId = useAuthStore.getState().user?.tenantId ?? 'default';
  const { headers: extraHeaders } = authHeaders(accessToken);
  const res = await fetch(`/api/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      ...extraHeaders,
    },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Could not load document');
  const html = await res.text();
  const win = window.open('', '_blank', 'noopener,noreferrer,width=860,height=900');
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to print');
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function feeReceiptPath(paymentId: string) {
  return `/school-erp/documents/fee-receipt/${paymentId}`;
}

export function reportCardPath(reportCardId: string) {
  return `/school-erp/documents/report-card/${reportCardId}`;
}

export function certificatePath(certificateId: string) {
  return `/school-erp/documents/certificate/${certificateId}`;
}
