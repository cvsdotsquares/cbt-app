'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/layout/data-table';
import { schoolErpApi, candidatesApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { FileText, Plus, Printer } from 'lucide-react';
import { openSchoolDocument, certificatePath } from '@/lib/school-documents';

const CERT_TYPES = ['BONAFIDE', 'TRANSFER_CERTIFICATE', 'CHARACTER', 'FEE_RECEIPT', 'ID_CARD', 'ADMISSION_LETTER', 'CUSTOM'];

function asList<T>(v: unknown): T[] { return Array.isArray(v) ? v : []; }

export default function CertificatesPage() {
  const { accessToken } = useRequireAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);

  const { data: certsRaw } = useQuery({
    queryKey: ['erp-certificates'],
    queryFn: () => schoolErpApi.listCertificates(accessToken!) as Promise<unknown[]>,
    enabled: !!accessToken,
  });

  const { data: candidates } = useQuery({
    queryKey: ['candidates-mini'],
    queryFn: () => candidatesApi.list(accessToken!, 1, '', 100),
    enabled: !!accessToken && dialog,
  });

  const certs = asList<Record<string, unknown>>(certsRaw);

  const issue = useMutation({
    mutationFn: (body: Record<string, unknown>) => schoolErpApi.issueCertificate(accessToken!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-certificates'] }); setDialog(false); toast({ title: 'Certificate issued' }); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Documents & Certificates" description="Issue bonafide, TC, character certificates, and more." badge="Certificates" />

      {can(Permission.CERTIFICATE_MANAGE) && (
        <Button onClick={() => setDialog(true)}><Plus className="mr-2 h-4 w-4" /> Issue Certificate</Button>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Issued Certificates</CardTitle></CardHeader>
        <CardContent>
          {certs.length === 0 ? (
            <EmptyState title="No certificates" description="Issue certificates for students." icon={FileText} />
          ) : (
            <ul className="space-y-2">
              {certs.map((c) => {
                const cand = c.candidate as Record<string, Record<string, string>>;
                return (
                  <li key={String(c.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{String(c.title)}</p>
                      <p className="text-muted-foreground">{cand?.user ? `${cand.user.firstName} ${cand.user.lastName}` : 'Student'} · {String(c.certificateNo)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{String(c.type)}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => openSchoolDocument(certificatePath(String(c.id)), accessToken!)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Certificate</DialogTitle></DialogHeader>
          <form id="cert-form" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            issue.mutate({ candidateId: fd.get('candidateId'), type: fd.get('type'), title: fd.get('title') });
          }} className="space-y-3">
            <div>
              <Label>Student</Label>
              <select name="candidateId" required className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Select student</option>
                {(candidates?.items ?? []).map((c: { id: string; user?: { firstName: string; lastName: string } }) => (
                  <option key={c.id} value={c.id}>{c.user ? `${c.user.firstName} ${c.user.lastName}` : c.id}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select name="type" required className="w-full rounded-md border px-3 py-2 text-sm">
                {CERT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><Label>Title</Label><Input name="title" placeholder="Bonafide Certificate" required /></div>
          </form>
          <DialogFooter><Button type="submit" form="cert-form" disabled={issue.isPending}>Issue</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
