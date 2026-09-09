'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/layout/data-table';
import { SectionCard, ListRow } from '@/components/portal/section-card';
import type {
  ErpCalendarEvent,
  ErpCertificate,
  ErpFeeInvoice,
  ErpHomework,
  ErpLeaveApplication,
  ErpLiveClass,
  ErpReportCard,
  ErpTimetable,
  ErpTransport,
} from '@/components/portal/erp-types';
import {
  Award, BookOpen, Bus, Calendar, CalendarDays, FileText, IndianRupee,
  Library, Megaphone, NotebookPen, Printer, Video,
} from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function LiveClassesBanner({
  live,
  upcoming,
  onJoin,
  joinPending,
  canJoin = true,
}: {
  live: ErpLiveClass[];
  upcoming: ErpLiveClass[];
  onJoin?: (id: string) => void;
  joinPending?: boolean;
  canJoin?: boolean;
}) {
  const all = [...live, ...upcoming];

  if (!all.length) {
    return (
      <SectionCard
        title="Online classes"
        icon={Video}
        description="Live and scheduled video sessions for your batch"
        isEmpty
        empty={
          <p className="text-sm text-muted-foreground">
            No live or scheduled classes right now. When your teacher starts a session, it will appear here with a Join button.
          </p>
        }
      >
        {null}
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={live.length ? 'Live class in progress' : 'Upcoming online class'}
      icon={Video}
      highlight={live.length > 0}
      description={live.length ? 'Join now — your teacher is waiting' : 'Scheduled video sessions for your batch'}
    >
      <div className="space-y-2">
        {all.slice(0, 4).map((lc) => (
          <ListRow key={lc.id}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{lc.title}</p>
              <p className="text-xs text-muted-foreground">{lc.subject.name}</p>
            </div>
            <Badge variant={lc.status === 'LIVE' ? 'destructive' : 'secondary'}>
              {lc.status === 'LIVE' ? 'Live now' : 'Scheduled'}
            </Badge>
            {canJoin && onJoin && (
              <Button size="sm" variant={lc.status === 'LIVE' ? 'default' : 'outline'} onClick={() => onJoin(lc.id)} disabled={joinPending}>
                Join class
              </Button>
            )}
          </ListRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function TimetableSection({ timetable }: { timetable: ErpTimetable }) {
  if (!timetable?.slots?.length) {
    return (
      <SectionCard title="Weekly timetable" icon={CalendarDays} isEmpty empty={
        <p className="text-sm text-muted-foreground">Timetable not published yet.</p>
      }>
        {null}
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Weekly timetable" icon={CalendarDays} description="Your class schedule by period">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[520px] text-xs">
          <thead>
            <tr className="border-b border-border/60">
              <th className="p-2 text-left font-semibold text-muted-foreground">Period</th>
              {DAYS.map((d) => (
                <th key={d} className="p-2 text-left font-semibold text-muted-foreground">{d.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(timetable.periods ?? []).map((p) => (
              <tr key={p.periodNumber} className="border-b border-border/40">
                <td className="p-2 align-top">
                  <span className="font-medium">{p.label}</span>
                  <br />
                  <span className="text-muted-foreground">{p.startTime}–{p.endTime}</span>
                </td>
                {DAYS.map((day) => {
                  const slot = timetable.slots.find((s) => s.dayOfWeek === day && s.periodNumber === p.periodNumber);
                  return (
                    <td key={day} className="p-2 align-top">
                      {slot ? (
                        <span className="inline-block rounded-md bg-primary/5 px-2 py-1 font-medium text-primary">
                          {slot.subject.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function FeesSection({
  invoices,
  payingId,
  onPay,
}: {
  invoices: ErpFeeInvoice[];
  payingId?: string | null;
  onPay?: (id: string) => void;
}) {
  if (!invoices.length) {
    return (
      <SectionCard title="Fee invoices" icon={IndianRupee} isEmpty empty={
        <p className="text-sm text-muted-foreground">No fee invoices on record.</p>
      }>
        {null}
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Fee invoices" icon={IndianRupee} description="View dues and pay securely online">
      <div className="space-y-2">
        {invoices.map((inv) => {
          const due = inv.totalAmount - inv.discountAmount - inv.paidAmount;
          const paid = inv.status === 'PAID' || due <= 0;
          return (
            <ListRow key={inv.id}>
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{inv.invoiceNo}</p>
                <p className="font-medium">₹{(inv.totalAmount - inv.discountAmount).toLocaleString()}</p>
              </div>
              <span className="text-xs text-muted-foreground">Due {inv.dueDate}</span>
              <Badge variant={paid ? 'secondary' : 'destructive'}>{inv.status}</Badge>
              {!paid && onPay && (
                <Button size="sm" disabled={payingId === inv.id} onClick={() => onPay(inv.id)}>
                  {payingId === inv.id ? 'Processing…' : 'Pay online'}
                </Button>
              )}
            </ListRow>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function HomeworkSection({ homeworks }: { homeworks: ErpHomework[] }) {
  if (!homeworks.length) {
    return (
      <SectionCard title="Homework" icon={NotebookPen} isEmpty empty={
        <p className="text-sm text-muted-foreground">No homework assigned right now.</p>
      }>
        {null}
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Homework" icon={NotebookPen} description="Assignments from your teachers">
      <div className="space-y-2">
        {homeworks.slice(0, 8).map((hw) => (
          <ListRow key={hw.id}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{hw.title}</p>
              <p className="text-xs text-muted-foreground">{hw.subject.name} · Due {hw.dueDate.slice(0, 10)}</p>
            </div>
            <Badge variant={hw.mySubmission ? 'secondary' : 'outline'}>
              {hw.mySubmission?.status ?? 'Pending'}
            </Badge>
          </ListRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function NoticesSection({ notices }: { notices: { id: string; title: string; body: string }[] }) {
  if (!notices.length) return null;

  return (
    <SectionCard title="School notices" icon={Megaphone} description="Announcements from administration">
      <div className="space-y-2">
        {notices.slice(0, 5).map((n) => (
          <div key={n.id} className="rounded-lg border border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-3">
            <p className="font-medium">{n.title}</p>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{n.body}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function ReportCardsSection({
  cards,
  onPrint,
}: {
  cards: ErpReportCard[];
  onPrint?: (id: string) => void;
}) {
  if (!cards.length) return null;

  return (
    <SectionCard title="Report cards" icon={Award} description="Published term results">
      <div className="space-y-2">
        {cards.map((rc) => (
          <ListRow key={rc.id}>
            <div>
              <p className="font-medium">{rc.termName} · {rc.academicYear}</p>
              <p className="text-sm text-muted-foreground">Grade {rc.overallGrade} · {rc.percentage.toFixed(1)}%</p>
            </div>
            {onPrint && (
              <Button size="sm" variant="ghost" onClick={() => onPrint(rc.id)}>
                <Printer className="h-4 w-4" />
              </Button>
            )}
          </ListRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function TransportSection({ transport }: { transport: ErpTransport | null }) {
  if (!transport) return null;

  return (
    <SectionCard title="School transport" icon={Bus} description={`Route ${transport.routeCode}`}>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="font-semibold">{transport.routeName}</p>
          <p className="text-muted-foreground">{transport.startPoint} → {transport.endPoint}</p>
        </div>
        {transport.stops.length > 0 && (
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            {transport.stops.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-primary">{String(i + 1).padStart(2, '0')}</span>
                <span>{s.name}{s.pickUpTime ? ` · ${s.pickUpTime}` : ''}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </SectionCard>
  );
}

export function LibrarySection({ books }: { books: { id: string; bookTitle: string; dueDate: string }[] }) {
  if (!books.length) return null;

  return (
    <SectionCard title="Library books" icon={Library} description="Currently issued to you">
      <div className="space-y-2">
        {books.map((b) => (
          <ListRow key={b.id}>
            <span className="font-medium">{b.bookTitle}</span>
            <span className="text-xs text-muted-foreground">Return by {b.dueDate}</span>
          </ListRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function CalendarSection({ events }: { events: ErpCalendarEvent[] }) {
  if (!events.length) return null;

  return (
    <SectionCard title="School calendar" icon={Calendar} description="Holidays and upcoming events">
      <div className="space-y-2">
        {events.map((ev) => (
          <ListRow key={ev.id}>
            <span className="font-medium">{ev.title}</span>
            <Badge variant={ev.isHoliday ? 'default' : 'outline'}>
              {ev.startDate}{ev.isHoliday ? ' · Holiday' : ''}
            </Badge>
          </ListRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function CertificatesSection({
  certificates,
  onPrint,
}: {
  certificates: ErpCertificate[];
  onPrint?: (id: string) => void;
}) {
  if (!certificates.length) return null;

  return (
    <SectionCard title="Certificates" icon={FileText} description="Bonafide, character & achievement certificates">
      <div className="space-y-2">
        {certificates.map((c) => (
          <ListRow key={c.id}>
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.certificateNo}</p>
            </div>
            {onPrint && (
              <Button size="sm" variant="ghost" onClick={() => onPrint(c.id)}>
                <Printer className="h-4 w-4" />
              </Button>
            )}
          </ListRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function LeaveSection({
  applications,
  onApply,
}: {
  applications: ErpLeaveApplication[];
  onApply?: () => void;
}) {
  return (
    <SectionCard
      title="Leave applications"
      icon={BookOpen}
      action={onApply ? <Button size="sm" variant="outline" onClick={onApply}>Apply for leave</Button> : undefined}
    >
      {!applications.length ? (
        <p className="text-sm text-muted-foreground">No leave applications on record.</p>
      ) : (
        <div className="space-y-2">
          {applications.map((l) => (
            <ListRow key={l.id}>
              <span>{l.startDate} – {l.endDate}</span>
              <Badge variant="outline">{l.status}</Badge>
            </ListRow>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function AttendanceSection({ recent, percentage }: { recent: { date: string; status: string }[]; percentage: number | null }) {
  if (!recent.length && percentage == null) return null;

  return (
    <SectionCard title="Attendance" icon={CalendarDays} description="Last 30 days">
      {percentage != null && (
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl font-bold text-emerald-600">
            {percentage}%
          </div>
          <p className="text-sm text-muted-foreground">Present / late days in the last 30 days</p>
        </div>
      )}
      {recent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recent.map((a) => (
            <Badge
              key={a.date}
              variant={a.status === 'PRESENT' || a.status === 'LATE' ? 'secondary' : 'destructive'}
              className="font-mono text-[11px]"
            >
              {a.date.slice(5)} · {a.status}
            </Badge>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function ExamResultsSection({ results }: { results: { examTitle: string; percentage: number; rank?: number | null }[] }) {
  if (!results.length) return null;

  return (
    <SectionCard title="Exam results" icon={Award} description="Recent published scores">
      <div className="space-y-2">
        {results.map((r, i) => (
          <ListRow key={i}>
            <span className="font-medium">{r.examTitle}</span>
            <Badge variant="secondary">{r.percentage.toFixed(1)}%</Badge>
          </ListRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function NotEnrolledState() {
  return (
    <EmptyState
      icon={BookOpen}
      title="Not enrolled yet"
      description="Ask your school admin to enroll you in a class section to access timetable, fees, and more."
    />
  );
}
