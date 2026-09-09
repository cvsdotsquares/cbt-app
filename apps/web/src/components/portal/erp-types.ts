export type ErpFeeInvoice = {
  id: string;
  invoiceNo: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
};

export type ErpHomework = {
  id: string;
  title: string;
  dueDate: string;
  subject: { name: string };
  mySubmission?: { status: string } | null;
};

export type ErpLiveClass = {
  id: string;
  title: string;
  subject: { name: string };
  startTime: string;
  status: string;
};

export type ErpTimetable = {
  periods: { periodNumber: number; label: string; startTime: string; endTime: string }[];
  slots: { dayOfWeek: string; periodNumber: number; subject: { name: string }; room?: string | null }[];
};

export type ErpTransport = {
  routeName: string;
  routeCode: string;
  startPoint: string;
  endPoint: string;
  stops: { name: string; pickUpTime?: string | null }[];
};

export type ErpCalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  eventType: string;
  isHoliday: boolean;
};

export type ErpReportCard = {
  id: string;
  termName: string;
  academicYear: string;
  overallGrade: string;
  percentage: number;
};

export type ErpCertificate = {
  id: string;
  title: string;
  type: string;
  certificateNo: string;
};

export type ErpLeaveApplication = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  reason?: string | null;
};

export type StudentSchoolData = {
  candidateId?: string;
  batch: { id: string; name: string; className: string } | null;
  attendance: { percentage: number | null; recent: { date: string; status: string }[] };
  homeworks: ErpHomework[];
  notices: { id: string; title: string; body: string }[];
  timetable: ErpTimetable;
  liveClasses?: { live: ErpLiveClass[]; upcoming: ErpLiveClass[] };
  reportCards?: ErpReportCard[];
  fees?: { outstanding: number; invoices: ErpFeeInvoice[] };
  library?: { id: string; bookTitle: string; dueDate: string; status: string }[];
  transport?: ErpTransport | null;
  calendarEvents?: ErpCalendarEvent[];
  certificates?: ErpCertificate[];
  leaveApplications?: ErpLeaveApplication[];
};

export type ParentChildData = {
  candidateId: string;
  name: string;
  relation: string;
  batches: { id: string; name: string; className: string }[];
  attendancePercent: number | null;
  recentAttendance: { date: string; status: string }[];
  pendingHomework: number;
  homeworks: ErpHomework[];
  recentResults: { examTitle: string; percentage: number; rank?: number | null }[];
  recentNotices: { id: string; title: string; body: string; createdAt?: string }[];
  reportCards: ErpReportCard[];
  fees: { outstanding: number; invoices: ErpFeeInvoice[] };
  library: { id: string; bookTitle: string; dueDate: string; status: string }[];
  transport: ErpTransport | null;
  calendarEvents: ErpCalendarEvent[];
  certificates: ErpCertificate[];
  leaveApplications: ErpLeaveApplication[];
  liveClasses: { live: ErpLiveClass[]; upcoming: ErpLiveClass[] };
  timetable: ErpTimetable;
};
