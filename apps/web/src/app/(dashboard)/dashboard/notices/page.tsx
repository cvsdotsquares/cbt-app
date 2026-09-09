'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/layout/data-table';
import { schoolApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission, NoticeTarget } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatExamDateTime } from '@/lib/exam-dates';

type NoticeItem = {
  id: string;
  title: string;
  body: string;
  targetType: NoticeTarget;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
};

export default function NoticesPage() {
  const { accessToken } = useRequireAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage = can(Permission.NOTICE_MANAGE);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: () => schoolApi.listNotices(accessToken!) as Promise<NoticeItem[]>,
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: () => schoolApi.createNotice(accessToken!, { title, body, targetType: NoticeTarget.ALL }),
    onSuccess: () => {
      toast({ title: 'Notice published' });
      setOpen(false);
      setTitle('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteNotice(accessToken!, id),
    onSuccess: () => {
      toast({ title: 'Notice removed' });
      qc.invalidateQueries({ queryKey: ['notices'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices & Announcements"
        description="School-wide announcements visible to students, teachers, and parents."
        badge="Daily Operations"
      >
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New notice
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : notices.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={Megaphone}
            title="No notices yet"
            description="Publish holidays, exam dates, events, and important updates."
          />
          {canManage && (
            <div className="flex justify-center">
              <Button onClick={() => setOpen(true)}>Create notice</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div>
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatExamDateTime(n.createdAt)} · {n.createdBy.firstName} {n.createdBy.lastName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{n.targetType === NoticeTarget.ALL ? 'Everyone' : n.targetType}</Badge>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(n.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish notice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Holiday announcement" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!title || !body || createMutation.isPending}>
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
