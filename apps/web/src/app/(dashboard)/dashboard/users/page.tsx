'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { usersApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from '@/hooks/use-toast';
import { Search, Users, Pencil, Trash2 } from 'lucide-react';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { EditUserDialog, type EditableUser } from '@/components/admin/edit-user-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, DataTableHeader, DataTableHead, DataTableRow, DataTableCell, EmptyState } from '@/components/layout/data-table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type UserItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  userRoles: { role: { id: string; name: string } }[];
};

type UsersPageData = { items: UserItem[]; totalPages: number };

export default function UsersPage() {
  const { accessToken, user: currentUser } = useRequireAuth(true);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const [editUser, setEditUser] = useState<EditableUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: () => usersApi.list(accessToken!, page, debouncedSearch) as Promise<UsersPageData>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => usersApi.roles(accessToken!) as Promise<{ id: string; name: string }[]>,
    enabled: !!accessToken,
  });

  const roleList = roles || [];

  const removeMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.removeRole(accessToken!, userId, roleId),
    onMutate: async ({ userId, roleId }) => {
      await queryClient.cancelQueries({ queryKey: ['users', page, debouncedSearch] });
      const previous = queryClient.getQueryData<UsersPageData>(['users', page, debouncedSearch]);
      queryClient.setQueryData<UsersPageData>(['users', page, debouncedSearch], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((u) =>
            u.id === userId
              ? { ...u, userRoles: u.userRoles.filter((ur) => ur.role.id !== roleId) }
              : u,
          ),
        };
      });
      return { previous };
    },
    onSuccess: () => toast({ title: 'Role removed', variant: 'success' }),
    onError: (e: Error, _, context) => {
      if (context?.previous) queryClient.setQueryData(['users', page, debouncedSearch], context.previous);
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.assignRole(accessToken!, userId, roleId),
    onMutate: async ({ userId, roleId }) => {
      const role = roleList.find((r) => r.id === roleId);
      if (!role) return;
      await queryClient.cancelQueries({ queryKey: ['users', page, debouncedSearch] });
      const previous = queryClient.getQueryData<UsersPageData>(['users', page, debouncedSearch]);
      queryClient.setQueryData<UsersPageData>(['users', page, debouncedSearch], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((u) =>
            u.id === userId
              ? { ...u, userRoles: [...u.userRoles, { role }] }
              : u,
          ),
        };
      });
      return { previous };
    },
    onSuccess: () => toast({ title: 'Role assigned', variant: 'success' }),
    onError: (e: Error, _, context) => {
      if (context?.previous) queryClient.setQueryData(['users', page, debouncedSearch], context.previous);
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => usersApi.remove(accessToken!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User deactivated', variant: 'success' });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const items = data?.items || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        description="Manage organization users and role assignments"
        badge={data ? `${items.length} on page` : undefined}
      >
        {can(Permission.USER_CREATE) && (
          <CreateUserDialog accessToken={accessToken!} roles={roleList} />
        )}
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </PageHeader>

      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : (
        <DataTable>
          <table className="w-full">
            <DataTableHeader>
              <DataTableHead>Name</DataTableHead>
              <DataTableHead>Email</DataTableHead>
              <DataTableHead>Roles</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>MFA</DataTableHead>
              <DataTableHead>Last Login</DataTableHead>
              <DataTableHead>Assign Role</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </DataTableHeader>
            <tbody>
              {items.map((u) => {
                const assignedIds = new Set(u.userRoles.map((ur) => ur.role.id));
                const availableRoles = roleList.filter((r) => !assignedIds.has(r.id));
                return (
                  <DataTableRow key={u.id}>
                    <DataTableCell className="font-medium">{u.firstName} {u.lastName}</DataTableCell>
                    <DataTableCell>{u.email}</DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.userRoles.map((ur) => (
                          <Badge key={ur.role.id} variant="secondary" className="gap-1 pr-1">
                            {ur.role.name}
                            {can(Permission.USER_ASSIGN_ROLE) && (
                              <button
                                type="button"
                                className="ml-1 rounded px-1 hover:bg-muted"
                                title="Remove role"
                                onClick={() => removeMutation.mutate({ userId: u.id, roleId: ur.role.id })}
                              >
                                ×
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={u.status === 'ACTIVE' ? 'success' : 'warning'}>{u.status}</Badge>
                    </DataTableCell>
                    <DataTableCell>{u.mfaEnabled ? '✓' : '—'}</DataTableCell>
                    <DataTableCell className="text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </DataTableCell>
                    <DataTableCell>
                      {can(Permission.USER_ASSIGN_ROLE) ? (
                        <select
                          className="h-8 rounded border border-input bg-background px-2 text-xs"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) assignMutation.mutate({ userId: u.id, roleId: e.target.value });
                            e.target.value = '';
                          }}
                        >
                          <option value="">+ Role</option>
                          {availableRoles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {can(Permission.USER_UPDATE) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Edit user"
                            onClick={() => setEditUser({
                              id: u.id,
                              firstName: u.firstName,
                              lastName: u.lastName,
                              email: u.email,
                              status: u.status,
                            })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {can(Permission.USER_DELETE) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            title="Deactivate user"
                            disabled={u.id === currentUser?.id}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </tbody>
          </table>
          {!items.length && (
            <EmptyState
              icon={Users}
              title="No users found"
              description={debouncedSearch ? 'Try a different search term.' : 'Create your first user to get started.'}
            />
          )}
        </DataTable>
      )}

      {isFetching && !isLoading && (
        <p className="text-center text-xs text-muted-foreground">Updating...</p>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground">Page {page} of {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <EditUserDialog
        accessToken={accessToken!}
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => { if (!open) setEditUser(null); }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate user?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  <span className="font-medium text-foreground">
                    {deleteTarget.firstName} {deleteTarget.lastName}
                  </span>{' '}
                  ({deleteTarget.email}) will be set to <strong>Inactive</strong> and signed out of all sessions.
                  You can reactivate them later from Edit.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteTarget}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
