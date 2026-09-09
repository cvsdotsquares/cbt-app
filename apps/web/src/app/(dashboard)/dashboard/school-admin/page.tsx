'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/layout/data-table';
import { schoolErpApi, candidatesApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import {
  Building2, Calendar, GraduationCap, IndianRupee, Bus, BookOpen,
  Users, Home, Package, Bell, ShieldAlert, Plus, Printer,
} from 'lucide-react';
import { openSchoolDocument, reportCardPath } from '@/lib/school-documents';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'admissions', label: 'Admissions', icon: GraduationCap, perm: Permission.ADMISSION_READ },
  { id: 'fees', label: 'Fees', icon: IndianRupee, perm: Permission.FEE_READ },
  { id: 'report-cards', label: 'Report Cards', icon: GraduationCap, perm: Permission.REPORT_CARD_READ },
  { id: 'calendar', label: 'Calendar', icon: Calendar, perm: Permission.CALENDAR_READ },
  { id: 'transport', label: 'Transport', icon: Bus, perm: Permission.TRANSPORT_READ },
  { id: 'library', label: 'Library', icon: BookOpen, perm: Permission.LIBRARY_READ },
  { id: 'hr', label: 'HR & Payroll', icon: Users, perm: Permission.HR_READ },
  { id: 'hostel', label: 'Hostel', icon: Home, perm: Permission.HOSTEL_READ },
  { id: 'inventory', label: 'Inventory', icon: Package, perm: Permission.INVENTORY_READ },
  { id: 'comms', label: 'Communications', icon: Bell, perm: Permission.NOTIFICATION_READ },
] as const;

type TabId = (typeof TABS)[number]['id'];

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function SchoolAdminPage() {
  const { accessToken } = useRequireAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const visibleTabs = TABS.filter((t) => {
    const perm = 'perm' in t ? t.perm : undefined;
    return !perm || can(perm);
  });
  const [tab, setTab] = useState<TabId>('overview');
  const [dialog, setDialog] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['erp-dashboard'],
    queryFn: () => schoolErpApi.dashboard(accessToken!) as Promise<Record<string, unknown>>,
    enabled: !!accessToken && tab === 'overview',
  });

  const { data: enquiriesRaw } = useQuery({
    queryKey: ['erp-enquiries'],
    queryFn: () => schoolErpApi.listEnquiries(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'admissions',
  });

  const enquiries = asList<Record<string, unknown>>(enquiriesRaw);

  const { data: applicationsRaw } = useQuery({
    queryKey: ['erp-applications'],
    queryFn: () => schoolErpApi.listApplications(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'admissions',
  });

  const { data: feeSummary } = useQuery({
    queryKey: ['erp-fee-summary'],
    queryFn: () => schoolErpApi.feeSummary(accessToken!) as Promise<Record<string, number>>,
    enabled: !!accessToken && tab === 'fees',
  });

  const applications = asList<Record<string, unknown>>(applicationsRaw);

  const { data: invoicesRaw } = useQuery({
    queryKey: ['erp-invoices'],
    queryFn: () => schoolErpApi.listFeeInvoices(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'fees',
  });

  const invoices = asList<Record<string, unknown>>(invoicesRaw);

  const { data: reportCardsRaw } = useQuery({
    queryKey: ['erp-report-cards'],
    queryFn: () => schoolErpApi.listReportCards(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'report-cards',
  });

  const reportCards = asList<Record<string, unknown>>(reportCardsRaw);

  const { data: calendarEventsRaw } = useQuery({
    queryKey: ['erp-calendar'],
    queryFn: () => schoolErpApi.listCalendar(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'calendar',
  });

  const calendarEvents = asList<Record<string, unknown>>(calendarEventsRaw);

  const { data: routesRaw } = useQuery({
    queryKey: ['erp-transport'],
    queryFn: () => schoolErpApi.listTransportRoutes(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'transport',
  });

  const routes = asList<Record<string, unknown>>(routesRaw);

  const { data: booksRaw } = useQuery({
    queryKey: ['erp-library'],
    queryFn: () => schoolErpApi.listLibraryBooks(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'library',
  });

  const books = asList<Record<string, unknown>>(booksRaw);

  const { data: staffRaw } = useQuery({
    queryKey: ['erp-staff'],
    queryFn: () => schoolErpApi.listStaff(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'hr',
  });

  const staff = asList<Record<string, unknown>>(staffRaw);

  const { data: hostelsRaw } = useQuery({
    queryKey: ['erp-hostel'],
    queryFn: () => schoolErpApi.listHostels(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'hostel',
  });

  const hostels = asList<Record<string, unknown>>(hostelsRaw);

  const { data: inventoryRaw } = useQuery({
    queryKey: ['erp-inventory'],
    queryFn: () => schoolErpApi.listInventory(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'inventory',
  });

  const inventory = asList<Record<string, unknown>>(inventoryRaw);

  const { data: notificationsRaw } = useQuery({
    queryKey: ['erp-notifications'],
    queryFn: () => schoolErpApi.listNotifications(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'comms',
  });

  const notifications = asList<Record<string, unknown>>(notificationsRaw);

  const { data: disciplineRaw } = useQuery({
    queryKey: ['erp-discipline'],
    queryFn: () => schoolErpApi.listDiscipline(accessToken!) as Promise<Record<string, unknown>[]>,
    enabled: !!accessToken && tab === 'comms',
  });

  const discipline = asList<Record<string, unknown>>(disciplineRaw);

  const { data: candidates } = useQuery({
    queryKey: ['candidates-mini'],
    queryFn: () => candidatesApi.list(accessToken!, 1, '', 100),
    enabled: !!accessToken && !!dialog,
  });

  function invalidate(keys: string[]) {
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Administration"
        description="Complete school management — admissions, fees, report cards, transport, library, HR, hostel, and more."
        badge="School ERP"
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              variant={tab === t.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab(t.id)}
              className={cn('gap-1.5')}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </Button>
          );
        })}
      </div>

      {tab === 'overview' && summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="New Enquiries" value={String((summary.admissions as Record<string, number>)?.newEnquiries ?? 0)} />
          <StatCard title="Fee Outstanding" value={`₹${asNumber((summary.fees as Record<string, unknown>)?.outstanding).toLocaleString()}`} />
          <StatCard title="Staff" value={String(summary.staff ?? 0)} />
          <StatCard title="Library Books" value={String((summary.library as Record<string, number>)?.totalBooks ?? 0)} />
          <StatCard title="Transport Routes" value={String((summary.transport as Record<string, number>)?.activeRoutes ?? 0)} />
          <StatCard title="Hostels" value={String((summary.hostel as Record<string, number>)?.totalHostels ?? 0)} />
          <StatCard title="Low Stock Items" value={String((summary.inventory as Record<string, number>)?.lowStockItems ?? 0)} />
          <StatCard title="Pending Applications" value={String((summary.admissions as Record<string, number>)?.pendingApplications ?? 0)} />
        </div>
      )}

      {tab === 'admissions' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ModuleCard title="Enquiries" action={can(Permission.ADMISSION_MANAGE) ? () => setDialog('enquiry') : undefined} actionLabel="Add enquiry">
            {enquiries.length === 0 ? <EmptyState title="No enquiries" description="Track admission leads here." icon={GraduationCap} /> : (
              <ul className="space-y-2">
                {enquiries.slice(0, 10).map((e) => (
                  <li key={String(e.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{String(e.studentName)}</p>
                      <p className="text-muted-foreground">{String(e.classApplied)} · {String(e.phone)}</p>
                    </div>
                    <Badge variant="outline">{String(e.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </ModuleCard>
          <ModuleCard title="Applications" action={can(Permission.ADMISSION_MANAGE) ? () => setDialog('application') : undefined} actionLabel="New application">
            {applications.length === 0 ? <EmptyState title="No applications" description="Manage admission forms and status." icon={GraduationCap} /> : (
              <ul className="space-y-2">
                {applications.slice(0, 10).map((a) => (
                  <li key={String(a.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{String(a.studentName)}</p>
                      <p className="text-muted-foreground">{String(a.applicationNo)} · {String(a.classApplied)}</p>
                    </div>
                    <Badge>{String(a.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </ModuleCard>
        </div>
      )}

      {tab === 'fees' && (
        <div className="space-y-4">
          {feeSummary && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="Total Due" value={`₹${asNumber(feeSummary.totalDue).toLocaleString()}`} />
              <StatCard title="Collected" value={`₹${asNumber(feeSummary.totalPaid).toLocaleString()}`} />
              <StatCard title="Outstanding" value={`₹${asNumber(feeSummary.outstanding).toLocaleString()}`} />
            </div>
          )}
          <ModuleCard title="Fee Invoices" action={can(Permission.FEE_MANAGE) ? () => setDialog('invoice') : undefined} actionLabel="Create invoice">
            {invoices.length === 0 ? <EmptyState title="No invoices" description="Generate and collect school fees." icon={IndianRupee} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Invoice</th><th className="p-2">Student</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const c = inv.candidate as Record<string, Record<string, string>>;
                      return (
                        <tr key={String(inv.id)} className="border-b">
                          <td className="p-2 font-mono text-xs">{String(inv.invoiceNo)}</td>
                          <td className="p-2">{c?.user ? `${c.user.firstName} ${c.user.lastName}` : '—'}</td>
                          <td className="p-2">₹{Number(inv.totalAmount).toLocaleString()}</td>
                          <td className="p-2"><Badge variant="outline">{String(inv.status)}</Badge></td>
                          <td className="p-2">
                            {can(Permission.FEE_COLLECT) && inv.status !== 'PAID' && (
                              <Button size="sm" variant="outline" onClick={() => setDialog(`pay-${inv.id}`)}>Collect</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ModuleCard>
        </div>
      )}

      {tab === 'report-cards' && (
        <ModuleCard title="Published Report Cards">
          {reportCards.length === 0 ? <EmptyState title="No report cards" description="Enter grades by term, then generate report cards." icon={GraduationCap} /> : (
            <ul className="space-y-2">
              {reportCards.map((rc) => {
                const c = rc.candidate as Record<string, Record<string, string>>;
                const term = rc.term as Record<string, unknown>;
                return (
                  <li key={String(rc.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{c?.user ? `${c.user.firstName} ${c.user.lastName}` : 'Student'}</p>
                      <p className="text-muted-foreground">{String(term?.name)} · Grade {String(rc.overallGrade)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{Number(rc.percentage).toFixed(1)}%</Badge>
                      <Button size="sm" variant="ghost" onClick={() => openSchoolDocument(reportCardPath(String(rc.id)), accessToken!)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ModuleCard>
      )}

      {tab === 'calendar' && (
        <ModuleCard title="Academic Calendar" action={can(Permission.CALENDAR_MANAGE) ? () => setDialog('calendar') : undefined} actionLabel="Add event">
          {calendarEvents.length === 0 ? <EmptyState title="No events" description="Holidays, exams, and school events." icon={Calendar} /> : (
            <ul className="space-y-2">
              {calendarEvents.map((ev) => (
                <li key={String(ev.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{String(ev.title)}</p>
                    <p className="text-muted-foreground">{String(ev.startDate).slice(0, 10)}</p>
                  </div>
                  <Badge variant={ev.isHoliday ? 'default' : 'outline'}>{ev.isHoliday ? 'Holiday' : String(ev.eventType)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </ModuleCard>
      )}

      {tab === 'transport' && (
        <ModuleCard title="Transport Routes" action={can(Permission.TRANSPORT_MANAGE) ? () => setDialog('route') : undefined} actionLabel="Add route">
          {routes.length === 0 ? <EmptyState title="No routes" description="Manage bus routes and student assignments." icon={Bus} /> : (
            <ul className="space-y-2">
              {routes.map((r) => (
                <li key={String(r.id)} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{String(r.name)} ({String(r.code)})</p>
                  <p className="text-muted-foreground">{String(r.startPoint)} → {String(r.endPoint)} · ₹{Number(r.monthlyFee)}/mo</p>
                </li>
              ))}
            </ul>
          )}
        </ModuleCard>
      )}

      {tab === 'library' && (
        <ModuleCard title="Library Catalog" action={can(Permission.LIBRARY_MANAGE) ? () => setDialog('book') : undefined} actionLabel="Add book">
          {books.length === 0 ? <EmptyState title="No books" description="Catalog books and track issue/return." icon={BookOpen} /> : (
            <ul className="space-y-2">
              {books.map((b) => (
                <li key={String(b.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{String(b.title)}</p>
                    <p className="text-muted-foreground">{String(b.author ?? 'Unknown author')}</p>
                  </div>
                  <Badge variant="outline">{String(b.available)}/{String(b.totalCopies)} available</Badge>
                </li>
              ))}
            </ul>
          )}
        </ModuleCard>
      )}

      {tab === 'hr' && (
        <div className="space-y-4">
          <ModuleCard title="Staff Directory" action={can(Permission.HR_MANAGE) ? () => setDialog('staff') : undefined} actionLabel="Add staff">
            {staff.length === 0 ? <EmptyState title="No staff profiles" description="Employee records, leave, and payroll." icon={Users} /> : (
              <ul className="space-y-2">
                {staff.map((s) => {
                  const u = s.user as Record<string, string>;
                  return (
                    <li key={String(s.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-muted-foreground">{String(s.designation ?? s.department ?? 'Staff')} · {String(s.employeeId)}</p>
                        <p className="text-xs text-muted-foreground">Salary: ₹{asNumber(s.basicSalary).toLocaleString()}/mo</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ModuleCard>
          <p className="text-xs text-muted-foreground">Leave requests and salary slips are managed from the same HR module in the admin panel.</p>
        </div>
      )}

      {tab === 'hostel' && (
        <ModuleCard title="Hostels" action={can(Permission.HOSTEL_MANAGE) ? () => setDialog('hostel') : undefined} actionLabel="Add hostel">
          {hostels.length === 0 ? <EmptyState title="No hostels" description="Room allocation and hostel management." icon={Home} /> : (
            <ul className="space-y-2">
              {hostels.map((h) => (
                <li key={String(h.id)} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{String(h.name)}</p>
                  <p className="text-muted-foreground">Warden: {String(h.wardenName ?? '—')} · {(h.rooms as unknown[])?.length ?? 0} rooms</p>
                </li>
              ))}
            </ul>
          )}
        </ModuleCard>
      )}

      {tab === 'inventory' && (
        <ModuleCard title="Inventory" action={can(Permission.INVENTORY_MANAGE) ? () => setDialog('inventory') : undefined} actionLabel="Add item">
          {inventory.length === 0 ? <EmptyState title="No inventory" description="Uniforms, books, lab equipment stock." icon={Package} /> : (
            <ul className="space-y-2">
              {inventory.map((item) => (
                <li key={String(item.id)} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{String(item.name)}</p>
                    <p className="text-muted-foreground">SKU: {String(item.sku)}</p>
                  </div>
                  <Badge variant={Number(item.quantity) <= Number(item.reorderLevel) ? 'destructive' : 'outline'}>
                    {String(item.quantity)} {String(item.unit)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </ModuleCard>
      )}

      {tab === 'comms' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ModuleCard title="Notifications" action={can(Permission.NOTIFICATION_SEND) ? () => setDialog('notify') : undefined} actionLabel="Send">
            {notifications.length === 0 ? <EmptyState title="No notifications sent" description="SMS, email, and in-app alerts." icon={Bell} /> : (
              <ul className="space-y-2">
                {notifications.slice(0, 8).map((n) => (
                  <li key={String(n.id)} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{String(n.subject ?? n.recipient)}</p>
                    <p className="text-muted-foreground line-clamp-2">{String(n.body)}</p>
                  </li>
                ))}
              </ul>
            )}
          </ModuleCard>
          <ModuleCard title="Discipline" action={can(Permission.DISCIPLINE_MANAGE) ? () => setDialog('discipline') : undefined} actionLabel="Record incident">
            {discipline.length === 0 ? (
              <EmptyState title="Discipline records" description="Track student conduct incidents." icon={ShieldAlert} />
            ) : (
              <ul className="space-y-2">
                {discipline.map((d) => {
                  const c = d.candidate as Record<string, Record<string, string>> | undefined;
                  return (
                    <li key={String(d.id)} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{String(d.category)}</p>
                        <Badge variant="outline">{String(d.severity)}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {c?.user ? `${c.user.firstName} ${c.user.lastName}` : 'Student'} · {String(d.incidentDate).slice(0, 10)}
                      </p>
                      <p className="mt-1 line-clamp-2">{String(d.description)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </ModuleCard>
        </div>
      )}

      <ErpDialogs
        dialog={dialog}
        setDialog={setDialog}
        accessToken={accessToken!}
        candidates={candidates?.items ?? []}
        onSuccess={(keys) => { setDialog(null); invalidate(keys); toast({ title: 'Saved successfully' }); }}
        onError={(e) => toast({ title: 'Error', description: e.message, variant: 'destructive' })}
      />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}

function ModuleCard({ title, children, action, actionLabel }: { title: string; children: React.ReactNode; action?: () => void; actionLabel?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        {action && <Button size="sm" onClick={action}><Plus className="mr-1 h-4 w-4" />{actionLabel}</Button>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ErpDialogs({
  dialog, setDialog, accessToken, candidates, onSuccess, onError,
}: {
  dialog: string | null;
  setDialog: (v: string | null) => void;
  accessToken: string;
  candidates: { id: string; user: { firstName: string; lastName: string } }[];
  onSuccess: (keys: string[]) => void;
  onError: (e: Error) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  async function submit(fn: () => Promise<unknown>, keys: string[]) {
    try {
      await fn();
      onSuccess(keys);
      setForm({});
    } catch (e) {
      onError(e instanceof Error ? e : new Error('Failed'));
    }
  }

  if (!dialog) return null;

  const payMatch = dialog.startsWith('pay-');
  const invoiceId = payMatch ? dialog.replace('pay-', '') : '';

  return (
    <Dialog open onOpenChange={() => setDialog(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {dialog === 'enquiry' && 'New Enquiry'}
            {dialog === 'application' && 'New Application'}
            {dialog === 'invoice' && 'Create Fee Invoice'}
            {payMatch && 'Record Payment'}
            {dialog === 'calendar' && 'Calendar Event'}
            {dialog === 'route' && 'Transport Route'}
            {dialog === 'book' && 'Add Book'}
            {dialog === 'hostel' && 'Add Hostel'}
            {dialog === 'inventory' && 'Inventory Item'}
            {dialog === 'notify' && 'Send Notification'}
            {dialog === 'discipline' && 'Discipline Record'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {dialog === 'enquiry' && (
            <>
              <Field label="Student name" value={form.studentName} onChange={(v) => setForm({ ...form, studentName: v })} />
              <Field label="Parent name" value={form.parentName} onChange={(v) => setForm({ ...form, parentName: v })} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Class applied" value={form.classApplied} onChange={(v) => setForm({ ...form, classApplied: v })} />
            </>
          )}
          {dialog === 'application' && (
            <>
              <Field label="Student name" value={form.studentName} onChange={(v) => setForm({ ...form, studentName: v })} />
              <Field label="Parent name" value={form.parentName} onChange={(v) => setForm({ ...form, parentName: v })} />
              <Field label="Parent phone" value={form.parentPhone} onChange={(v) => setForm({ ...form, parentPhone: v })} />
              <Field label="Class applied" value={form.classApplied} onChange={(v) => setForm({ ...form, classApplied: v })} />
            </>
          )}
          {dialog === 'invoice' && (
            <>
              <Label>Student</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.candidateId ?? ''} onChange={(e) => setForm({ ...form, candidateId: e.target.value })}>
                <option value="">Select student</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.user.firstName} {c.user.lastName}</option>)}
              </select>
              <Field label="Amount (₹)" value={form.totalAmount} onChange={(v) => setForm({ ...form, totalAmount: v })} />
              <Field label="Due date" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
            </>
          )}
          {payMatch && <Field label="Amount (₹)" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />}
          {dialog === 'calendar' && (
            <>
              <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
              <Field label="Start date" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isHoliday === 'true'} onChange={(e) => setForm({ ...form, isHoliday: String(e.target.checked) })} /> Holiday</label>
            </>
          )}
          {dialog === 'route' && (
            <>
              <Field label="Route name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
              <Field label="Start point" value={form.startPoint} onChange={(v) => setForm({ ...form, startPoint: v })} />
              <Field label="End point" value={form.endPoint} onChange={(v) => setForm({ ...form, endPoint: v })} />
              <Field label="Monthly fee (₹)" value={form.monthlyFee} onChange={(v) => setForm({ ...form, monthlyFee: v })} />
            </>
          )}
          {dialog === 'book' && (
            <>
              <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
              <Field label="Author" value={form.author} onChange={(v) => setForm({ ...form, author: v })} />
              <Field label="Copies" value={form.totalCopies} onChange={(v) => setForm({ ...form, totalCopies: v })} />
            </>
          )}
          {dialog === 'hostel' && (
            <>
              <Field label="Hostel name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Warden name" value={form.wardenName} onChange={(v) => setForm({ ...form, wardenName: v })} />
            </>
          )}
          {dialog === 'inventory' && (
            <>
              <Field label="Item name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
              <Field label="Quantity" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            </>
          )}
          {dialog === 'notify' && (
            <>
              <Field label="Recipient (email/phone)" value={form.recipient} onChange={(v) => setForm({ ...form, recipient: v })} />
              <Field label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
              <div><Label>Message</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            </>
          )}
          {dialog === 'discipline' && (
            <>
              <Label>Student</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.candidateId ?? ''} onChange={(e) => setForm({ ...form, candidateId: e.target.value })}>
                <option value="">Select student</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.user.firstName} {c.user.lastName}</option>)}
              </select>
              <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
              <Field label="Incident date" type="date" value={form.incidentDate} onChange={(v) => setForm({ ...form, incidentDate: v })} />
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
          <Button onClick={() => {
            if (dialog === 'enquiry') submit(() => schoolErpApi.createEnquiry(accessToken, form), ['erp-enquiries', 'erp-dashboard']);
            else if (dialog === 'application') submit(() => schoolErpApi.createApplication(accessToken, form), ['erp-applications', 'erp-dashboard']);
            else if (dialog === 'invoice') submit(() => schoolErpApi.createFeeInvoice(accessToken, { ...form, totalAmount: Number(form.totalAmount) }), ['erp-invoices', 'erp-fee-summary', 'erp-dashboard']);
            else if (payMatch) submit(() => schoolErpApi.recordFeePayment(accessToken, { invoiceId, amount: Number(form.amount), method: 'CASH' }), ['erp-invoices', 'erp-fee-summary']);
            else if (dialog === 'calendar') submit(() => schoolErpApi.createCalendarEvent(accessToken, { ...form, isHoliday: form.isHoliday === 'true' }), ['erp-calendar']);
            else if (dialog === 'route') submit(() => schoolErpApi.createTransportRoute(accessToken, { ...form, monthlyFee: Number(form.monthlyFee || 0) }), ['erp-transport', 'erp-dashboard']);
            else if (dialog === 'book') submit(() => schoolErpApi.createLibraryBook(accessToken, { ...form, totalCopies: Number(form.totalCopies || 1) }), ['erp-library', 'erp-dashboard']);
            else if (dialog === 'hostel') submit(() => schoolErpApi.createHostel(accessToken, form), ['erp-hostel', 'erp-dashboard']);
            else if (dialog === 'inventory') submit(() => schoolErpApi.createInventoryItem(accessToken, { ...form, quantity: Number(form.quantity || 0) }), ['erp-inventory', 'erp-dashboard']);
            else if (dialog === 'notify') submit(() => schoolErpApi.sendNotification(accessToken, form), ['erp-notifications']);
            else if (dialog === 'discipline') submit(() => schoolErpApi.createDiscipline(accessToken, form), ['erp-discipline']);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value?: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
