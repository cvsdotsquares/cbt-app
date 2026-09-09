'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/layout/data-table';
import { schoolErpApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { BookOpen, Plus } from 'lucide-react';

function asList<T>(v: unknown): T[] { return Array.isArray(v) ? v : []; }

export default function LibrarianDashboard() {
  const { accessToken } = useRequireAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);

  const { data: booksRaw } = useQuery({
    queryKey: ['erp-library', search],
    queryFn: () => schoolErpApi.listLibraryBooks(accessToken!, search || undefined) as Promise<unknown[]>,
    enabled: !!accessToken,
  });
  const books = asList<Record<string, unknown>>(booksRaw);

  const createBook = useMutation({
    mutationFn: (body: Record<string, unknown>) => schoolErpApi.createLibraryBook(accessToken!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-library'] }); setDialog(false); toast({ title: 'Book added' }); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Library Dashboard" description="Manage book catalog, issue, and return." badge="Library" />

      <div className="flex gap-2">
        <Input placeholder="Search books..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button onClick={() => setDialog(true)}><Plus className="mr-2 h-4 w-4" /> Add Book</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Book Catalog ({books.length})</CardTitle></CardHeader>
        <CardContent>
          {books.length === 0 ? (
            <EmptyState title="No books" description="Add books to the catalog." icon={BookOpen} />
          ) : (
            <ul className="space-y-2">
              {books.map((b) => (
                <li key={String(b.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{String(b.title)}</p>
                    <p className="text-muted-foreground">{String(b.author ?? 'Unknown author')} · {String(b.category ?? 'General')}</p>
                  </div>
                  <span className="text-muted-foreground">{String(b.available)}/{String(b.totalCopies)} available</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Book</DialogTitle></DialogHeader>
          <form id="book-form" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createBook.mutate({ title: fd.get('title'), author: fd.get('author'), isbn: fd.get('isbn'), category: fd.get('category'), totalCopies: Number(fd.get('copies') || 1) }); }} className="space-y-3">
            <div><Label>Title</Label><Input name="title" required /></div>
            <div><Label>Author</Label><Input name="author" /></div>
            <div><Label>ISBN</Label><Input name="isbn" /></div>
            <div><Label>Category</Label><Input name="category" /></div>
            <div><Label>Copies</Label><Input name="copies" type="number" defaultValue={1} min={1} /></div>
          </form>
          <DialogFooter><Button type="submit" form="book-form" disabled={createBook.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
