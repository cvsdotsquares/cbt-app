'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard } from '@/components/layout/stat-card';
import { PortalTabs } from '@/components/portal/portal-tabs';
import {
  AttendanceSection,
  CalendarSection,
  CertificatesSection,
  FeesSection,
  HomeworkSection,
  LeaveSection,
  LibrarySection,
  LiveClassesBanner,
  NotEnrolledState,
  NoticesSection,
  ReportCardsSection,
  TimetableSection,
  TransportSection,
} from '@/components/portal/erp-sections';
import type { StudentSchoolData } from '@/components/portal/erp-types';
import { schoolErpApi } from '@/lib/api';
import { openFeeCheckout } from '@/lib/razorpay-checkout';
import { openSchoolDocument, reportCardPath, certificatePath, feeReceiptPath } from '@/lib/school-documents';
import { toast } from '@/hooks/use-toast';
import {
  Award, BookOpen, CalendarDays, IndianRupee, LayoutGrid, NotebookPen,
  School, UserCheck, Video,
} from 'lucide-react';

export type { StudentSchoolData };

type SchoolTab = 'overview' | 'academics' | 'fees' | 'life';

type Props = {
  school: StudentSchoolData | undefined;
  loading: boolean;
  accessToken: string;
  onJoinLiveClass: (id: string) => void;
  joinPending: boolean;
};

export function StudentSchoolPanel({ school, loading, accessToken, onJoinLiveClass, joinPending }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<SchoolTab>('overview');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });

  if (loading) return null;
  if (!school?.batch) return <NotEnrolledState />;

  const pendingHw = school.homeworks.filter((h) => !h.mySubmission).length;
  const liveCount = (school.liveClasses?.live.length ?? 0) + (school.liveClasses?.upcoming.length ?? 0);

  async function payInvoice(invoiceId: string) {
    setPayingId(invoiceId);
    try {
      const order = await schoolErpApi.createPaymentOrder(accessToken, invoiceId) as {
        orderId: string; gatewayOrderId: string; amount: number; currency: string;
        razorpayKeyId?: string; mock?: boolean;
      };
      await openFeeCheckout({
        ...order,
        onSuccess: async (payload) => {
          const result = await schoolErpApi.verifyPayment(
            accessToken,
            order.orderId,
            payload.razorpayPaymentId,
            payload.razorpaySignature,
          ) as { paymentId?: string; receiptNo?: string };
          qc.invalidateQueries({ queryKey: ['student-school'] });
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
    if (!school?.candidateId) return;
    try {
      await schoolErpApi.applyStudentLeave(accessToken, {
        candidateId: school.candidateId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      });
      qc.invalidateQueries({ queryKey: ['student-school'] });
      setLeaveOpen(false);
      setLeaveForm({ startDate: '', endDate: '', reason: '' });
      toast({ title: 'Leave application submitted' });
    } catch (e) {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' });
    }
  }

  const printReport = (id: string) => openSchoolDocument(reportCardPath(id), accessToken);
  const printCert = (id: string) => openSchoolDocument(certificatePath(id), accessToken);

  return (
    <div className="space-y-6">
      <div className="hero-banner-student relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl portal-hero-orb" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Badge className="gap-1 border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
              <School className="h-3 w-3" /> My School
            </Badge>
            <h2 className="text-xl font-bold sm:text-2xl">
              {school.batch.className} —{' '}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                {school.batch.name}
              </span>
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Timetable, fees, live classes, homework, transport, and school documents — all in one place.
            </p>
          </div>
          {(school.liveClasses?.live.length ?? 0) > 0 && (
            <Button
              className="shrink-0 gap-2 border-0 bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg hover:opacity-95"
              onClick={() => onJoinLiveClass(school.liveClasses!.live[0].id)}
              disabled={joinPending}
            >
              <Video className="h-4 w-4" /> Join live class
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Attendance (30d)"
          value={school.attendance.percentage != null ? `${school.attendance.percentage}%` : '—'}
          icon={UserCheck}
          accent={school.attendance.percentage != null && school.attendance.percentage >= 75 ? 'green' : 'amber'}
        />
        <StatCard title="Pending homework" value={pendingHw} icon={NotebookPen} accent={pendingHw > 0 ? 'amber' : 'green'} />
        <StatCard
          title="Fee outstanding"
          value={school.fees?.outstanding ? `₹${school.fees.outstanding.toLocaleString()}` : 'Clear'}
          icon={IndianRupee}
          accent={school.fees?.outstanding ? 'amber' : 'green'}
        />
        <StatCard title="Report cards" value={school.reportCards?.length ?? 0} icon={Award} accent="violet" />
      </div>

      <LiveClassesBanner
        live={school.liveClasses?.live ?? []}
        upcoming={school.liveClasses?.upcoming ?? []}
        onJoin={onJoinLiveClass}
        joinPending={joinPending}
      />

      <PortalTabs
        active={tab}
        onChange={(id) => setTab(id as SchoolTab)}
        tabs={[
          { id: 'overview', label: 'Overview', icon: LayoutGrid, badge: liveCount || undefined },
          { id: 'academics', label: 'Academics', icon: BookOpen, badge: pendingHw || undefined },
          { id: 'fees', label: 'Fees & docs', icon: IndianRupee },
          { id: 'life', label: 'School life', icon: CalendarDays },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <NoticesSection notices={school.notices} />
          <CalendarSection events={school.calendarEvents ?? []} />
          <AttendanceSection recent={school.attendance.recent} percentage={school.attendance.percentage} />
        </div>
      )}

      {tab === 'academics' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <TimetableSection timetable={school.timetable} />
          </div>
          <HomeworkSection homeworks={school.homeworks} />
          <ReportCardsSection cards={school.reportCards ?? []} onPrint={printReport} />
        </div>
      )}

      {tab === 'fees' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <FeesSection
            invoices={school.fees?.invoices ?? []}
            payingId={payingId}
            onPay={payInvoice}
          />
          <CertificatesSection certificates={school.certificates ?? []} onPrint={printCert} />
          <ReportCardsSection cards={school.reportCards ?? []} onPrint={printReport} />
        </div>
      )}

      {tab === 'life' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <TransportSection transport={school.transport ?? null} />
          <LibrarySection books={school.library ?? []} />
          <LeaveSection
            applications={school.leaveApplications ?? []}
            onApply={() => setLeaveOpen(true)}
          />
          <CalendarSection events={school.calendarEvents ?? []} />
        </div>
      )}

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
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
