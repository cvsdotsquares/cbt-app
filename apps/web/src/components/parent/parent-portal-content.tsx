'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard } from '@/components/layout/stat-card';
import { EmptyState } from '@/components/layout/data-table';
import {
  AttendanceSection,
  CalendarSection,
  CertificatesSection,
  ExamResultsSection,
  FeesSection,
  HomeworkSection,
  LeaveSection,
  LibrarySection,
  LiveClassesBanner,
  NoticesSection,
  ReportCardsSection,
  TimetableSection,
  TransportSection,
} from '@/components/portal/erp-sections';
import type { ParentChildData } from '@/components/portal/erp-types';
import { schoolApi, schoolErpApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { openFeeCheckout } from '@/lib/razorpay-checkout';
import { openSchoolDocument, feeReceiptPath, reportCardPath, certificatePath } from '@/lib/school-documents';
import { toast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Award, BookOpen, GraduationCap, IndianRupee, NotebookPen,
  UserCheck, Users,
} from 'lucide-react';
import { PortalHero } from '@/components/portal/portal-hero';
import { PortalQuickCard } from '@/components/portal/portal-quick-card';

type ParentDashboard = { children: ParentChildData[] };

export type ParentSection = 'overview' | 'academics' | 'fees' | 'life';

export function ParentPortalContent({ section }: { section: ParentSection }) {
  const { user, accessToken } = useAuthStore();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => schoolApi.parentDashboard(accessToken!) as Promise<ParentDashboard>,
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (data?.children.length && !activeChildId) {
      setActiveChildId(data.children[0].candidateId);
    }
  }, [data, activeChildId]);

  if (!accessToken) return null;

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';
  const child = data?.children.find((c) => c.candidateId === activeChildId) ?? data?.children[0];

  return (
    <div className="space-y-6 animate-fade-in sm:space-y-8">
      {section === 'overview' && (
        <PortalHero
          variant="parent"
          greeting={greeting}
          userName={user?.firstName}
          title="Your family"
          highlight="school dashboard"
          description="Track attendance, homework, fees, report cards, transport, and announcements — synced live from your school's ERP."
          chip={child ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <GraduationCap className="h-3.5 w-3.5" />
              {child.name} · {child.batches.map((b) => `${b.className} ${b.name}`).join(', ')}
            </span>
          ) : undefined}
        />
      )}

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : !data?.children.length ? (
        <EmptyState
          icon={Users}
          title="No children linked"
          description="Contact your school admin to link your parent account to your child's profile."
        />
      ) : (
        <>
          {data.children.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {data.children.map((c) => (
                <button
                  key={c.candidateId}
                  type="button"
                  onClick={() => setActiveChildId(c.candidateId)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all',
                    activeChildId === c.candidateId
                      ? 'border-emerald-500/35 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-emerald-700 shadow-sm dark:text-emerald-300'
                      : 'border-border/60 bg-card text-muted-foreground hover:border-emerald-500/20 hover:text-foreground',
                  )}
                >
                  <GraduationCap className="h-4 w-4" />
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {child && section === 'overview' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PortalQuickCard href="/parent/academics" label="Academics" description="Timetable, homework & report cards" icon={BookOpen} color="emerald" badge={child.pendingHomework || undefined} />
              <PortalQuickCard href="/parent/fees" label="Fees & Docs" description="Pay invoices & download certificates" icon={IndianRupee} color="amber" badge={child.fees.invoices.filter((i) => i.status !== 'PAID').length || undefined} />
              <PortalQuickCard href="/parent/life" label="School Life" description="Transport, library & leave" icon={GraduationCap} color="sky" />
              <PortalQuickCard href="/parent/academics" label="Results" description={`${child.recentResults.length} recent exam scores`} icon={Award} color="violet" />
            </div>
          )}

          {child && <ParentChildDashboard child={child} section={section} accessToken={accessToken!} />}
        </>
      )}
    </div>
  );
}

function ParentChildDashboard({
  child,
  section,
  accessToken,
}: {
  child: ParentChildData;
  section: ParentSection;
  accessToken: string;
}) {
  const qc = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });

  async function payInvoice(invoiceId: string) {
    setPayingId(invoiceId);
    try {
      const order = await schoolErpApi.createPaymentOrder(accessToken, invoiceId) as {
        orderId: string; gatewayOrderId: string; amount: number; currency: string;
        razorpayKeyId?: string; mock?: boolean;
      };
      await openFeeCheckout({
        ...order,
        studentName: child.name,
        onSuccess: async (payload) => {
          const result = await schoolErpApi.verifyPayment(
            accessToken,
            order.orderId,
            payload.razorpayPaymentId,
            payload.razorpaySignature,
          ) as { paymentId?: string; receiptNo?: string };
          qc.invalidateQueries({ queryKey: ['parent-dashboard'] });
          toast({ title: 'Payment successful', description: `Receipt: ${result.receiptNo ?? '—'}` });
          if (result.paymentId) {
            openSchoolDocument(feeReceiptPath(result.paymentId), accessToken).catch(() => {});
          }
        },
      });
    } catch (e) {
      toast({ title: 'Payment failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' });
    } finally {
      setPayingId(null);
    }
  }

  async function submitLeave() {
    try {
      await schoolErpApi.applyStudentLeave(accessToken, {
        candidateId: child.candidateId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      });
      qc.invalidateQueries({ queryKey: ['parent-dashboard'] });
      setLeaveOpen(false);
      setLeaveForm({ startDate: '', endDate: '', reason: '' });
      toast({ title: 'Leave application submitted' });
    } catch (e) {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.07] to-teal-500/[0.04] p-4 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{child.name}</h2>
          <p className="text-sm text-muted-foreground">
            {child.relation} · {child.batches.map((b) => `${b.className} ${b.name}`).join(', ')}
          </p>
        </div>
        <Badge variant="outline">{child.batches.length ? 'Enrolled' : 'Not enrolled'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Attendance (30d)"
          value={child.attendancePercent != null ? `${child.attendancePercent}%` : '—'}
          icon={UserCheck}
          accent={child.attendancePercent != null && child.attendancePercent >= 75 ? 'green' : 'amber'}
        />
        <StatCard
          title="Pending homework"
          value={child.pendingHomework}
          icon={NotebookPen}
          accent={child.pendingHomework > 0 ? 'amber' : 'green'}
        />
        <StatCard
          title="Fee outstanding"
          value={child.fees.outstanding > 0 ? `₹${child.fees.outstanding.toLocaleString()}` : 'Clear'}
          icon={IndianRupee}
          accent={child.fees.outstanding > 0 ? 'amber' : 'green'}
        />
        <StatCard title="Report cards" value={child.reportCards.length} icon={Award} accent="violet" />
      </div>

      <LiveClassesBanner
        live={child.liveClasses.live}
        upcoming={child.liveClasses.upcoming}
        canJoin={false}
      />

      {section === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <NoticesSection notices={child.recentNotices} />
          <ExamResultsSection results={child.recentResults} />
          <CalendarSection events={child.calendarEvents} />
          <AttendanceSection recent={child.recentAttendance} percentage={child.attendancePercent} />
        </div>
      )}

      {section === 'academics' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <TimetableSection timetable={child.timetable} />
          </div>
          <HomeworkSection homeworks={child.homeworks} />
          <ReportCardsSection
            cards={child.reportCards}
            onPrint={(id) => openSchoolDocument(reportCardPath(id), accessToken)}
          />
          <ExamResultsSection results={child.recentResults} />
        </div>
      )}

      {section === 'fees' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <FeesSection invoices={child.fees.invoices} payingId={payingId} onPay={payInvoice} />
          <CertificatesSection
            certificates={child.certificates}
            onPrint={(id) => openSchoolDocument(certificatePath(id), accessToken)}
          />
          <ReportCardsSection
            cards={child.reportCards}
            onPrint={(id) => openSchoolDocument(reportCardPath(id), accessToken)}
          />
        </div>
      )}

      {section === 'life' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <TransportSection transport={child.transport} />
          <LibrarySection books={child.library} />
          <LeaveSection applications={child.leaveApplications} onApply={() => setLeaveOpen(true)} />
          <CalendarSection events={child.calendarEvents} />
        </div>
      )}

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply leave for {child.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Start date</Label><Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} /></div>
            <div><Label>End date</Label><Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} /></div>
            <div><Label>Reason</Label><Input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button onClick={submitLeave} disabled={!leaveForm.startDate || !leaveForm.endDate}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
