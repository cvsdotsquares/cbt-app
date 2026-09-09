import { useAuthStore } from '@/stores/auth-store';
import { isAdmin, isCandidate, normalizeRoles } from './roles';

const RENDER_API_BASE =
  process.env.API_PROXY_URL || 'https://cbt-api-ktkr.onrender.com';

/**
 * Browser always uses same-origin `/api/v1` proxy (HttpOnly cookie auth, no CORS).
 * SSR uses the configured API base URL.
 */
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }
  return `${RENDER_API_BASE.replace(/\/$/, '')}/api/v1`;
}

function isHtmlResponse(raw: string): boolean {
  const trimmed = raw.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

function formatNonJsonError(raw: string, ok: boolean): string {
  if (ok) return 'Invalid response from server';
  const lower = raw.toLowerCase();
  if (lower.includes('vercel.com/login') || lower.includes('authentication required')) {
    return 'This preview link requires Vercel login. Use https://cbt-app-jade.vercel.app instead.';
  }
  if (lower.includes('currently unavailable') || lower.includes('onrender.com')) {
    return 'API is waking up (free tier). Wait 30–60 seconds, then try again.';
  }
  return 'API unavailable. Wait 30 seconds and try again.';
}

import { fetchWithColdStartRetry as fetchWithBackoff, shouldUseColdStartRetry } from './cold-start-retry';

async function fetchWithColdStartRetry(url: string, init: RequestInit): Promise<Response> {
  return fetchWithBackoff(url, init, (status, raw) =>
    status >= 502 || status === 503 || isHtmlResponse(raw),
  );
}

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_TENANT_ID || 'default';

function getTenantId(): string {
  return DEFAULT_TENANT;
}

function getAuthTenantId(): string {
  if (typeof window !== 'undefined') {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (tenantId) return tenantId;
  }
  return DEFAULT_TENANT;
}

export interface ApiOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Refresh failed');
    await useAuthStore.getState().updateTokens(data.accessToken, data.refreshToken);
    if (data.user) {
      useAuthStore.setState({ user: data.user, isAuthenticated: true });
    }
    return data.accessToken as string;
  } catch {
    useAuthStore.getState().logout().finally(() => {
      if (typeof window !== 'undefined') window.location.href = '/login';
    });
    return null;
  }
}

export type Paginated<T> = {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export type ExamListItem = {
  id: string;
  title: string;
  code: string;
  status: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  settings?: { durationMinutes?: number; [key: string]: unknown };
  sections?: { id: string; _count?: { questions: number } }[];
  aiTestConfig?: {
    batch?: {
      id: string;
      name: string;
      academicYear: string;
      academicClass: { id: string; name: string; level: number };
    } | null;
  } | null;
  _count?: { registrations: number; sessions: number; results: number };
};

export type ExamDetail = Omit<ExamListItem, 'sections'> & {
  registrations?: { candidateId: string }[];
  aiTestConfig?: {
    batchId?: string | null;
    batch?: {
      id: string;
      name: string;
      academicYear: string;
      academicClass: { id: string; name: string; level: number };
    } | null;
  } | null;
  sections?: {
    id: string;
    name?: string;
    _count?: { questions: number };
    questions?: {
      questionId: string;
      question: {
        title?: string;
        type: string;
        status: string;
        versions?: {
          content?: { text?: string };
          options?: Record<string, string>;
          correctAnswer?: { value?: string | string[] };
          marks?: number;
          negativeMarks?: number;
        }[];
      };
    }[];
  }[];
};

export type CandidateListItem = {
  id: string;
  registrationNumber: string;
  kycStatus?: string;
  createdAt?: string;
  user: { firstName: string; lastName: string; email: string; status?: string };
  batchEnrollments?: {
    id: string;
    rollNumber?: string | null;
    batch: {
      id: string;
      name: string;
      academicYear: string;
      academicClass: { id: string; name: string; level: number };
    };
  }[];
};

export type QuestionListItem = {
  id: string;
  title: string | null;
  type: string;
  difficulty: string;
  status: string;
  versions?: { content?: { text?: string } }[];
};

export type AuditLogItem = {
  id: string;
  action: string;
  entityType?: string;
  resourceType?: string;
  entityId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { firstName?: string; lastName?: string; email: string };
};

export type ExamAnalytics = {
  registered: number;
  submitted: number;
  violations: number;
  completionRate: number;
  averageScore: number;
};

export type ExamResultListItem = {
  id: string;
  rank?: number | null;
  totalScore: number;
  maxScore: number;
  percentage: number;
  published: boolean;
  candidate: { user: { firstName: string; lastName: string } };
};

export type SubjectiveResponseItem = {
  id: string;
  sessionId: string;
  questionId: string;
  answer: unknown;
  marksAwarded: number | null;
  question: { title: string; type: string; versions: { marks: number }[] };
  session: { candidate: { user: { firstName: string; lastName: string; email: string } } };
};

export type ResultReviewQuestion = {
  number: number;
  questionId: string;
  type: string;
  title: string;
  text: string;
  sectionName: string;
  options: Record<string, string>;
  candidateAnswer: string[];
  candidateAnswerLabel: string;
  correctAnswer: string[];
  correctAnswerLabel: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  maxMarks: number;
  explanation: string | null;
  answered: boolean;
};

export type ResultReview = {
  resultId: string;
  examTitle: string;
  examCode: string;
  candidateName: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  published: boolean;
  questions: ResultReviewQuestion[];
};

export async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, skipAuth, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  let authToken = token;
  if (!skipAuth && !authToken) {
    authToken = useAuthStore.getState().accessToken ?? undefined;
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  headers['X-Tenant-ID'] = skipAuth ? getTenantId() : getAuthTenantId();

  const requestUrl = `${getApiUrl()}${endpoint}`;
  const useColdStartRetry = typeof window !== 'undefined' && shouldUseColdStartRetry(requestUrl);

  let response = useColdStartRetry
    ? await fetchWithColdStartRetry(requestUrl, { ...fetchOptions, headers, credentials: 'include' })
    : await fetch(requestUrl, { ...fetchOptions, headers, credentials: 'include' });

  if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/refresh')) {
    if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    const newToken = await refreshPromise;
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = useColdStartRetry
        ? await fetchWithColdStartRetry(requestUrl, { ...fetchOptions, headers, credentials: 'include' })
        : await fetch(requestUrl, { ...fetchOptions, headers, credentials: 'include' });
    }
  }

  const raw = await response.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(formatNonJsonError(raw, response.ok));
  }
  if (!response.ok) {
    throw new Error(formatApiError(data));
  }
  return (data as { data?: T }).data ?? (data as T);
}

function formatApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed';
  const record = data as Record<string, unknown>;
  const nested =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>).message
      : undefined;
  const message = nested ?? record.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.length > 0) return message;
  return 'Request failed';
}

export function authHeaders(token: string) {
  return { token, headers: { 'X-Device-Fingerprint': getFingerprint() } };
}

export function getFingerprint() {
  if (typeof window === 'undefined') return 'server';
  let fp = localStorage.getItem('device-fp');
  if (!fp) {
    fp = `fp-${navigator.userAgent.slice(0, 30)}-${Date.now()}`;
    localStorage.setItem('device-fp', fp);
  }
  return fp;
}

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...body, deviceFingerprint: getFingerprint() }),
      skipAuth: true,
    }),
  register: (body: { email: string; password: string; firstName: string; lastName: string }) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...body, deviceFingerprint: getFingerprint() }),
      skipAuth: true,
    }),
  verifyMfa: (body: { mfaToken: string; totpCode: string }) =>
    apiFetch('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(body),
      skipAuth: true,
    }),
  refresh: (refreshToken: string) =>
    apiFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    }),
  logout: (token: string) =>
    apiFetch('/auth/logout', { method: 'POST', ...authHeaders(token) }),
  sessions: (token: string) => apiFetch('/auth/sessions', authHeaders(token)),
  loginHistory: (token: string) => apiFetch('/auth/login-history', authHeaders(token)),
};

export const dashboardApi = {
  stats: (token: string) => apiFetch('/analytics/dashboard', authHeaders(token)),
};

export const examsApi = {
  list: (token: string, page = 1, search = '', limit = 20) =>
    apiFetch<Paginated<ExamListItem>>(
      `/exams?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      authHeaders(token),
    ),
  get: (token: string, id: string) => apiFetch<ExamDetail>(`/exams/${id}`, authHeaders(token)),
  instructions: (token: string, id: string) => apiFetch(`/exams/${id}/instructions`, authHeaders(token)),
  create: (token: string, body: unknown) =>
    apiFetch('/exams', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  publish: (token: string, id: string) =>
    apiFetch(`/exams/${id}/publish`, { method: 'POST', ...authHeaders(token) }),
  assignCandidates: (token: string, id: string, candidateIds: string[]) =>
    apiFetch<{ count?: number; skipped?: number }>(`/exams/${id}/candidates`, {
      method: 'POST',
      body: JSON.stringify({ candidateIds }),
      ...authHeaders(token),
    }),
  syncCandidates: (token: string, id: string, candidateIds: string[]) =>
    apiFetch<{ assigned?: number; added?: number; removed?: number }>(`/exams/${id}/candidates`, {
      method: 'PUT',
      body: JSON.stringify({ candidateIds }),
      ...authHeaders(token),
    }),
  addQuestions: (token: string, id: string, sectionId: string, questionIds: string[]) =>
    apiFetch<{ added?: number; skipped?: number }>(`/exams/${id}/questions`, {
      method: 'POST',
      body: JSON.stringify({ sectionId, questionIds }),
      ...authHeaders(token),
    }),
  removeQuestion: (token: string, examId: string, questionId: string) =>
    apiFetch(`/exams/${examId}/questions/${questionId}`, { method: 'DELETE', ...authHeaders(token) }),
  remove: (token: string, id: string) =>
    apiFetch(`/exams/${id}`, { method: 'DELETE', ...authHeaders(token) }),
  updateSchedule: (token: string, id: string, body: {
    startTime: string;
    endTime: string;
    timezone?: string;
    durationMinutes?: number;
  }) =>
    apiFetch(`/exams/${id}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...authHeaders(token),
    }),
  myExams: (token: string) => apiFetch('/exams/my/available', authHeaders(token)),
};

export const questionsApi = {
  list: (token: string, page = 1, filters: { search?: string; type?: string; status?: string; limit?: number } = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(filters.limit ?? 20) });
    if (filters.search) params.set('search', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    return apiFetch<Paginated<QuestionListItem>>(`/questions?${params}`, authHeaders(token));
  },
  create: (token: string, body: unknown) =>
    apiFetch('/questions', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  get: (token: string, id: string) =>
    apiFetch<QuestionListItem>(`/questions/${id}`, authHeaders(token)),
  update: (token: string, id: string, body: unknown) =>
    apiFetch(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(body), ...authHeaders(token) }),
  approve: (token: string, id: string) =>
    apiFetch(`/questions/${id}/approve`, { method: 'POST', ...authHeaders(token) }),
  remove: (token: string, id: string) =>
    apiFetch(`/questions/${id}`, { method: 'DELETE', ...authHeaders(token) }),
};

export const candidatesApi = {
  list: (
    token: string,
    page = 1,
    search = '',
    limit = 20,
    filters?: { batchId?: string; academicClassId?: string; unassigned?: boolean },
  ) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) q.set('search', search);
    if (filters?.batchId) q.set('batchId', filters.batchId);
    if (filters?.academicClassId) q.set('academicClassId', filters.academicClassId);
    if (filters?.unassigned) q.set('unassigned', 'true');
    return apiFetch<Paginated<CandidateListItem>>(`/candidates?${q}`, authHeaders(token));
  },
  create: (token: string, body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    registrationNumber?: string;
    batchId?: string;
    rollNumber?: string;
  }) =>
    apiFetch('/candidates', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  dashboard: (token: string) => apiFetch('/candidates/me/dashboard', authHeaders(token)),
  admitCard: (token: string, examId: string) =>
    apiFetch(`/candidates/me/admit-card/${examId}`, authHeaders(token)),
  verifyKyc: (token: string, id: string, status: 'VERIFIED' | 'REJECTED') =>
    apiFetch(`/candidates/${id}/kyc/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      ...authHeaders(token),
    }),
  stats: (token: string) => apiFetch('/candidates/stats', authHeaders(token)),
  update: (
    token: string,
    id: string,
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      registrationNumber?: string;
      status?: string;
      password?: string;
    },
  ) => apiFetch(`/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(body), ...authHeaders(token) }),
  remove: (token: string, id: string) =>
    apiFetch(`/candidates/${id}`, { method: 'DELETE', ...authHeaders(token) }),
  setBatch: (token: string, id: string, body: { batchId: string | null; rollNumber?: string }) =>
    apiFetch(`/candidates/${id}/batch`, { method: 'PATCH', body: JSON.stringify(body), ...authHeaders(token) }),
  submitKyc: (token: string, body: { documentType: string; idNumber: string; fileName: string; fileData: string }) =>
    apiFetch('/candidates/me/kyc', {
      method: 'POST',
      body: JSON.stringify(body),
      ...authHeaders(token),
    }),
};

export const usersApi = {
  list: (token: string, page = 1, search = '', limit = 20) =>
    apiFetch(`/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`, authHeaders(token)),
  create: (token: string, body: { email: string; password: string; firstName: string; lastName: string; roleIds?: string[] }) =>
    apiFetch('/users', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  get: (token: string, id: string) => apiFetch(`/users/${id}`, authHeaders(token)),
  roles: (token: string) => apiFetch('/users/meta/roles', authHeaders(token)),
  assignRole: (token: string, userId: string, roleId: string) =>
    apiFetch(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
      ...authHeaders(token),
    }),
  removeRole: (token: string, userId: string, roleId: string) =>
    apiFetch(`/users/${userId}/roles/${roleId}`, { method: 'DELETE', ...authHeaders(token) }),
  update: (
    token: string,
    id: string,
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      status?: string;
      password?: string;
      roleId?: string | null;
    },
  ) => apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body), ...authHeaders(token) }),
  remove: (token: string, id: string) =>
    apiFetch(`/users/${id}`, { method: 'DELETE', ...authHeaders(token) }),
};

export const resultsApi = {
  byExam: (token: string, examId: string) =>
    apiFetch<Paginated<ExamResultListItem>>(`/results/exam/${examId}`, authHeaders(token)),
  exportCsv: async (token: string, examId: string) => {
    const url = `${getApiUrl()}/results/exam/${examId}/export`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': getAuthTenantId(),
    };
    const useRetry = typeof window !== 'undefined' && shouldUseColdStartRetry(url);
    const res = useRetry
      ? await fetchWithColdStartRetry(url, { headers, credentials: 'include' })
      : await fetch(url, { headers, credentials: 'include' });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
  my: (token: string) => apiFetch('/results/my', authHeaders(token)),
  review: (token: string, resultId: string) =>
    apiFetch<ResultReview>(`/results/review/${resultId}`, authHeaders(token)),
  certificate: (token: string, resultId: string) =>
    apiFetch(`/results/my/${resultId}/certificate`, authHeaders(token)),
  evaluate: (token: string, sessionId: string) =>
    apiFetch(`/results/evaluate/${sessionId}`, { method: 'POST', ...authHeaders(token) }),
  rank: (token: string, examId: string) =>
    apiFetch(`/results/rank/${examId}`, { method: 'POST', ...authHeaders(token) }),
  publish: (token: string, examId: string) =>
    apiFetch(`/results/publish/${examId}`, { method: 'POST', ...authHeaders(token) }),
  subjective: (token: string, examId: string) =>
    apiFetch<SubjectiveResponseItem[]>(`/results/exam/${examId}/subjective`, authHeaders(token)),
  grade: (token: string, sessionId: string, questionId: string, marksAwarded: number) =>
    apiFetch(`/results/grade/${sessionId}/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ marksAwarded }),
      ...authHeaders(token),
    }),
  verifyCertificate: (resultId: string) =>
    apiFetch(`/results/verify/${resultId}`, { skipAuth: true }),
};

export const examSessionApi = {
  start: (token: string, examId: string) =>
    apiFetch('/exam-sessions/start', {
      method: 'POST',
      body: JSON.stringify({ examId }),
      ...authHeaders(token),
    }),
  get: (token: string, sessionId: string) =>
    apiFetch(`/exam-sessions/${sessionId}`, authHeaders(token)),
  saveAnswer: (token: string, sessionId: string, body: unknown) =>
    apiFetch(`/exam-sessions/${sessionId}/responses`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...authHeaders(token),
    }),
  markReview: (token: string, sessionId: string, questionId: string, marked: boolean) =>
    apiFetch(`/exam-sessions/${sessionId}/mark-review`, {
      method: 'POST',
      body: JSON.stringify({ questionId, marked }),
      ...authHeaders(token),
    }),
  submit: (
    token: string,
    sessionId: string,
    body?: {
      answers?: {
        questionId: string;
        answer: unknown;
        timeSpentSeconds?: number;
        markedForReview?: boolean;
      }[];
    },
  ) =>
    apiFetch(`/exam-sessions/${sessionId}/submit`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
      ...authHeaders(token),
    }),
  heartbeat: (
    token: string,
    sessionId: string,
    body?: {
      answers?: {
        questionId: string;
        answer: unknown;
        timeSpentSeconds?: number;
        markedForReview?: boolean;
      }[];
    },
  ) =>
    apiFetch(`/exam-sessions/${sessionId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
      ...authHeaders(token),
    }),
};

export const proctoringApi = {
  recordEvent: (token: string, body: {
    sessionId: string;
    eventType: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }) =>
    apiFetch('/proctoring/events', {
      method: 'POST',
      body: JSON.stringify(body),
      ...authHeaders(token),
    }),
  live: (token: string, examId: string) =>
    apiFetch(`/proctoring/sessions/${examId}/live`, authHeaders(token)),
  intervene: (token: string, sessionId: string, type: string, message?: string) =>
    apiFetch(`/proctoring/sessions/${sessionId}/intervene`, {
      method: 'POST',
      body: JSON.stringify({ type, message }),
      ...authHeaders(token),
    }),
};

export const auditApi = {
  list: (token: string, page = 1, limit = 20) =>
    apiFetch<Paginated<AuditLogItem>>(`/audit/logs?page=${page}&limit=${limit}`, authHeaders(token)),
};

export const analyticsApi = {
  exam: (token: string, examId: string) =>
    apiFetch<ExamAnalytics>(`/analytics/exam/${examId}`, authHeaders(token)),
};

export const aiApi = {
  status: (token: string) => apiFetch('/ai/status', authHeaders(token)),
  generateQuestions: (token: string, body: { topic: string; count?: number; difficulty?: string; type?: string }) =>
    apiFetch('/ai/questions/generate', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  generateRagQuestions: (token: string, body: {
    subjectId: string; batchId?: string; chapterIds?: string[];
    topicIds?: string[]; syllabusScope?: string; count?: number;
    difficulty?: string; types?: string[];
  }) => apiFetch('/ai/rag/generate', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  createAiTest: (token: string, body: {
    title: string; subjectId?: string; batchId?: string; allSubjects?: boolean;
    chapterIds?: string[]; questionCount?: number; questionsPerSubject?: number;
    difficulty?: string; questionTypes?: string[]; syllabusScope?: string;
    durationMinutes?: number; assignToBatch?: boolean;
  }) => apiFetch('/ai/tests/create', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  explain: (token: string, body: { questionText: string; correctAnswer: string }) =>
    apiFetch('/ai/explain', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  examInsights: (token: string, examId: string) =>
    apiFetch(`/ai/insights/exam/${examId}`, authHeaders(token)),
  chat: (token: string, message: string, context?: { page?: string }) =>
    apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, context }), ...authHeaders(token) }),
};

export const curriculumApi = {
  getClasses: (token: string, options?: { uploadedOnly?: boolean }) => {
    const q = options?.uploadedOnly ? '?uploadedOnly=true' : '';
    return apiFetch(`/curriculum/classes${q}`, authHeaders(token));
  },
  getClass: (token: string, id: string) => apiFetch(`/curriculum/classes/${id}`, authHeaders(token)),
  getSubjectChapters: (token: string, subjectId: string) =>
    apiFetch(`/curriculum/subjects/${subjectId}/chapters`, authHeaders(token)),
};

export const batchesApi = {
  list: (token: string) => apiFetch('/batches', authHeaders(token)),
  get: (token: string, id: string) => apiFetch(`/batches/${id}`, authHeaders(token)),
  create: (token: string, body: { academicClassId: string; name: string; academicYear: string }) =>
    apiFetch('/batches', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  update: (token: string, id: string, body: { academicClassId?: string; name?: string; academicYear?: string; isActive?: boolean }) =>
    apiFetch(`/batches/${id}`, { method: 'PATCH', body: JSON.stringify(body), ...authHeaders(token) }),
  remove: (token: string, id: string) =>
    apiFetch(`/batches/${id}`, { method: 'DELETE', ...authHeaders(token) }),
  enroll: (token: string, batchId: string, body: { candidateId: string; rollNumber?: string }) =>
    apiFetch(`/batches/${batchId}/enroll`, { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  listTeachers: (token: string, batchId: string) =>
    apiFetch(`/batches/${batchId}/teachers`, authHeaders(token)),
  listTeacherAssignmentsByUser: (token: string, userId?: string) =>
    apiFetch(`/batches/teacher-assignments${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`, authHeaders(token)),
  assignTeacher: (token: string, batchId: string, body: { userId: string; subjectId?: string; subjectIds?: string[] }) =>
    apiFetch(`/batches/${batchId}/teachers`, { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  removeTeacher: (token: string, batchId: string, assignmentId: string) =>
    apiFetch(`/batches/${batchId}/teachers/${assignmentId}`, { method: 'DELETE', ...authHeaders(token) }),
  getSyllabusProgress: (token: string, batchId: string, subjectId?: string) =>
    apiFetch(`/batches/${batchId}/syllabus-progress${subjectId ? `?subjectId=${subjectId}` : ''}`, authHeaders(token)),
  updateSyllabusProgress: (token: string, batchId: string, body: { chapterId?: string; topicId?: string; status: string }) =>
    apiFetch(`/batches/${batchId}/syllabus-progress`, { method: 'PATCH', body: JSON.stringify(body), ...authHeaders(token) }),
};

export const materialsApi = {
  list: (token: string, params?: {
    chapterId?: string;
    type?: string;
    academicClassId?: string;
    subjectId?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.chapterId) q.set('chapterId', params.chapterId);
    if (params?.type) q.set('type', params.type);
    if (params?.academicClassId) q.set('academicClassId', params.academicClassId);
    if (params?.subjectId) q.set('subjectId', params.subjectId);
    return apiFetch(`/materials?${q}`, authHeaders(token));
  },
  upload: async (token: string, formData: FormData) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': getAuthTenantId(),
      'X-Device-Fingerprint': getFingerprint(),
    };
    const requestUrl = typeof window !== 'undefined'
      ? '/api/v1/materials/upload'
      : `${RENDER_API_BASE.replace(/\/$/, '')}/api/v1/materials/upload`;
    const useColdStartRetry = typeof window !== 'undefined' && shouldUseColdStartRetry(requestUrl);

    let res = useColdStartRetry
      ? await fetchWithColdStartRetry(requestUrl, { method: 'POST', headers, body: formData, credentials: 'include' })
      : await fetch(requestUrl, { method: 'POST', headers, body: formData, credentials: 'include' });

    if (res.status === 401) {
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        res = useColdStartRetry
          ? await fetchWithColdStartRetry(requestUrl, { method: 'POST', headers, body: formData, credentials: 'include' })
          : await fetch(requestUrl, { method: 'POST', headers, body: formData, credentials: 'include' });
      }
    }

    const raw = await res.text();
    let data: unknown;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(formatNonJsonError(raw, res.ok));
    }
    if (!res.ok) throw new Error(formatApiError(data));
    return (data as { data?: unknown }).data ?? data;
  },
  reindex: (token: string, id: string) =>
    apiFetch(`/materials/${id}/reindex`, { method: 'POST', ...authHeaders(token) }),
  delete: (token: string, id: string) =>
    apiFetch(`/materials/${id}`, { method: 'DELETE', ...authHeaders(token) }),
  openFile: async (token: string, id: string) => {
    const url = `${getApiUrl()}/materials/${id}/file`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': getAuthTenantId(),
        'X-Device-Fingerprint': getFingerprint(),
      },
      credentials: 'include',
    });
    if (!res.ok) {
      const raw = await res.text();
      let message = 'Could not open file';
      try {
        message = formatApiError(JSON.parse(raw));
      } catch {
        if (raw && !raw.trimStart().startsWith('{')) message = raw;
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  },
  downloadFile: async (token: string, id: string, fileName: string) => {
    const url = `${getApiUrl()}/materials/${id}/file?download=1`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': getAuthTenantId(),
        'X-Device-Fingerprint': getFingerprint(),
      },
      credentials: 'include',
    });
    if (!res.ok) {
      const raw = await res.text();
      let message = 'Could not download file';
      try {
        message = formatApiError(JSON.parse(raw));
      } catch {
        if (raw && !raw.trimStart().startsWith('{')) message = raw;
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
};

export const learningApi = {
  studentDashboard: (token: string) => apiFetch('/learning/student/dashboard', authHeaders(token)),
  recommendations: (token: string) => apiFetch('/learning/student/recommendations', authHeaders(token)),
  teacherAnalytics: (token: string, batchId: string, subjectId?: string) =>
    apiFetch(`/learning/teacher/batch/${batchId}/analytics${subjectId ? `?subjectId=${subjectId}` : ''}`, authHeaders(token)),
};

export const onboardingApi = {
  setupStatus: (token: string) => apiFetch('/onboarding/setup-status', authHeaders(token)),
};

export const schoolApi = {
  getPeriods: (token: string) => apiFetch('/school/periods', authHeaders(token)),
  updatePeriods: (token: string, periods: { periodNumber: number; label: string; startTime: string; endTime: string }[]) =>
    apiFetch('/school/periods', { method: 'PATCH', body: JSON.stringify({ periods }), ...authHeaders(token) }),
  getTimetable: (token: string, batchId: string) =>
    apiFetch(`/school/timetable?batchId=${batchId}`, authHeaders(token)),
  upsertTimetableSlot: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school/timetable/slots', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  deleteTimetableSlot: (token: string, id: string) =>
    apiFetch(`/school/timetable/slots/${id}`, { method: 'DELETE', ...authHeaders(token) }),
  getAttendance: (token: string, batchId: string, date: string) =>
    apiFetch(`/school/attendance?batchId=${batchId}&date=${date}`, authHeaders(token)),
  markAttendance: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school/attendance', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  attendanceReport: (token: string, batchId: string, from: string, to: string) =>
    apiFetch(`/school/attendance/report?batchId=${batchId}&from=${from}&to=${to}`, authHeaders(token)),
  listHomework: (token: string, params?: { batchId?: string; subjectId?: string }) => {
    const q = new URLSearchParams();
    if (params?.batchId) q.set('batchId', params.batchId);
    if (params?.subjectId) q.set('subjectId', params.subjectId);
    return apiFetch(`/school/homework?${q}`, authHeaders(token));
  },
  createHomework: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school/homework', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  getHomework: (token: string, id: string) => apiFetch(`/school/homework/${id}`, authHeaders(token)),
  submitHomework: (token: string, id: string, content: string) =>
    apiFetch(`/school/homework/${id}/submit`, { method: 'POST', body: JSON.stringify({ content }), ...authHeaders(token) }),
  gradeHomework: (token: string, submissionId: string, grade: string, feedback?: string) =>
    apiFetch(`/school/homework/submissions/${submissionId}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({ grade, feedback }),
      ...authHeaders(token),
    }),
  studentHomework: (token: string) => apiFetch('/school/student/homework', authHeaders(token)),
  listNotices: (token: string) => apiFetch('/school/notices', authHeaders(token)),
  createNotice: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school/notices', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  deleteNotice: (token: string, id: string) =>
    apiFetch(`/school/notices/${id}`, { method: 'DELETE', ...authHeaders(token) }),
  linkParent: (token: string, body: { parentUserId: string; candidateId: string; relation?: string }) =>
    apiFetch('/school/parents/link', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  parentDashboard: (token: string) => apiFetch('/school/parent/dashboard', authHeaders(token)),
  studentDashboard: (token: string) => apiFetch('/school/student/dashboard', authHeaders(token)),
  listLiveClasses: (token: string, params?: { batchId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.batchId) q.set('batchId', params.batchId);
    if (params?.status) q.set('status', params.status);
    return apiFetch(`/school/live-classes?${q}`, authHeaders(token));
  },
  createLiveClass: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school/live-classes', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  updateLiveClassStatus: (token: string, id: string, status: string, recordingUrl?: string) =>
    apiFetch(`/school/live-classes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, recordingUrl }),
      ...authHeaders(token),
    }),
  joinLiveClass: (token: string, id: string) =>
    apiFetch(`/school/live-classes/${id}/join`, { method: 'POST', ...authHeaders(token) }),
  studentLiveClasses: (token: string) => apiFetch('/school/student/live-classes', authHeaders(token)),
};

const erpHeaders = (token: string) => authHeaders(token);

export const schoolErpApi = {
  dashboard: (token: string) => apiFetch('/school-erp/dashboard', erpHeaders(token)),
  // Academic
  listAcademicYears: (token: string) => apiFetch('/school-erp/academic-years', erpHeaders(token)),
  createAcademicYear: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/academic-years', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listCalendar: (token: string, from?: string, to?: string) =>
    apiFetch(`/school-erp/calendar?${new URLSearchParams({ ...(from && { from }), ...(to && { to }) })}`, erpHeaders(token)),
  createCalendarEvent: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/calendar', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  // Admissions
  listEnquiries: (token: string, status?: string) =>
    apiFetch(`/school-erp/admissions/enquiries${status ? `?status=${status}` : ''}`, erpHeaders(token)),
  createEnquiry: (token: string, body: Record<string, string>) =>
    apiFetch('/school-erp/admissions/enquiries', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  updateEnquiryStatus: (token: string, id: string, status: string) =>
    apiFetch(`/school-erp/admissions/enquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), ...erpHeaders(token) }),
  listApplications: (token: string, status?: string) =>
    apiFetch(`/school-erp/admissions/applications${status ? `?status=${status}` : ''}`, erpHeaders(token)),
  createApplication: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/admissions/applications', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  updateApplicationStatus: (token: string, id: string, status: string, remarks?: string) =>
    apiFetch(`/school-erp/admissions/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }), ...erpHeaders(token) }),
  // Fees
  feeSummary: (token: string) => apiFetch('/school-erp/fees/summary', erpHeaders(token)),
  listFeeHeads: (token: string) => apiFetch('/school-erp/fees/heads', erpHeaders(token)),
  createFeeHead: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/fees/heads', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listFeeStructures: (token: string) => apiFetch('/school-erp/fees/structures', erpHeaders(token)),
  createFeeStructure: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/fees/structures', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listFeeInvoices: (token: string, candidateId?: string) =>
    apiFetch(`/school-erp/fees/invoices${candidateId ? `?candidateId=${candidateId}` : ''}`, erpHeaders(token)),
  createFeeInvoice: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/fees/invoices', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  recordFeePayment: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/fees/payments', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  // Report cards
  listTerms: (token: string) => apiFetch('/school-erp/terms', erpHeaders(token)),
  createTerm: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/terms', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listGrades: (token: string, termId: string, candidateId?: string) =>
    apiFetch(`/school-erp/grades?termId=${termId}${candidateId ? `&candidateId=${candidateId}` : ''}`, erpHeaders(token)),
  upsertGrade: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/grades', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listReportCards: (token: string, candidateId?: string) =>
    apiFetch(`/school-erp/report-cards${candidateId ? `?candidateId=${candidateId}` : ''}`, erpHeaders(token)),
  generateReportCard: (token: string, termId: string, candidateId: string) =>
    apiFetch('/school-erp/report-cards/generate', { method: 'POST', body: JSON.stringify({ termId, candidateId }), ...erpHeaders(token) }),
  // Transport
  listTransportRoutes: (token: string) => apiFetch('/school-erp/transport/routes', erpHeaders(token)),
  createTransportRoute: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/transport/routes', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  assignTransport: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/transport/assign', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  // Library
  listLibraryBooks: (token: string, search?: string) =>
    apiFetch(`/school-erp/library/books${search ? `?search=${encodeURIComponent(search)}` : ''}`, erpHeaders(token)),
  createLibraryBook: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/library/books', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  issueBook: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/library/issue', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  returnBook: (token: string, issueId: string) =>
    apiFetch(`/school-erp/library/return/${issueId}`, { method: 'POST', ...erpHeaders(token) }),
  // HR
  listStaff: (token: string) => apiFetch('/school-erp/hr/staff', erpHeaders(token)),
  createStaff: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/hr/staff', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listLeave: (token: string, status?: string) =>
    apiFetch(`/school-erp/hr/leave${status ? `?status=${status}` : ''}`, erpHeaders(token)),
  applyLeave: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/hr/leave', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  approveLeave: (token: string, id: string, approved: boolean) =>
    apiFetch(`/school-erp/hr/leave/${id}`, { method: 'PATCH', body: JSON.stringify({ approved }), ...erpHeaders(token) }),
  // Hostel
  listHostels: (token: string) => apiFetch('/school-erp/hostel', erpHeaders(token)),
  createHostel: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/hostel', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  createHostelRoom: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/hostel/rooms', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  allocateHostel: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/hostel/allocate', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  // Inventory
  listInventory: (token: string) => apiFetch('/school-erp/inventory', erpHeaders(token)),
  createInventoryItem: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/inventory', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  inventoryTransaction: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/inventory/transactions', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  // Notifications & discipline
  listNotifications: (token: string) => apiFetch('/school-erp/notifications', erpHeaders(token)),
  sendNotification: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/notifications', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listDiscipline: (token: string, candidateId?: string) =>
    apiFetch(`/school-erp/discipline${candidateId ? `?candidateId=${candidateId}` : ''}`, erpHeaders(token)),
  createDiscipline: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/discipline', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  // Extended ERP
  schoolReports: (token: string) => apiFetch('/school-erp/reports', erpHeaders(token)),
  listDepartments: (token: string) => apiFetch('/school-erp/departments', erpHeaders(token)),
  createDepartment: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/departments', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listBranches: (token: string) => apiFetch('/school-erp/branches', erpHeaders(token)),
  createBranch: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/branches', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listDefaulters: (token: string) => apiFetch('/school-erp/fees/defaulters', erpHeaders(token)),
  dailyCollection: (token: string, date?: string) =>
    apiFetch(`/school-erp/fees/daily-collection${date ? `?date=${date}` : ''}`, erpHeaders(token)),
  listScholarships: (token: string, candidateId?: string) =>
    apiFetch(`/school-erp/fees/scholarships${candidateId ? `?candidateId=${candidateId}` : ''}`, erpHeaders(token)),
  createScholarship: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/fees/scholarships', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  generateBatchInvoices: (token: string, batchId: string, feeStructureId: string) =>
    apiFetch('/school-erp/fees/generate-batch', { method: 'POST', body: JSON.stringify({ batchId, feeStructureId }), ...erpHeaders(token) }),
  createPaymentOrder: (token: string, invoiceId: string) =>
    apiFetch('/school-erp/fees/payment-order', { method: 'POST', body: JSON.stringify({ invoiceId }), ...erpHeaders(token) }),
  verifyPayment: (
    token: string,
    orderId: string,
    razorpayPaymentId?: string,
    razorpaySignature?: string,
  ) =>
    apiFetch('/school-erp/fees/payment-verify', {
      method: 'POST',
      body: JSON.stringify({ orderId, razorpayPaymentId, razorpaySignature }),
      ...erpHeaders(token),
    }),
  listStaffAttendance: (token: string, date?: string) =>
    apiFetch(`/school-erp/hr/staff-attendance${date ? `?date=${date}` : ''}`, erpHeaders(token)),
  markStaffAttendance: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/hr/staff-attendance', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listStudentLeave: (token: string, status?: string) =>
    apiFetch(`/school-erp/student-leave${status ? `?status=${status}` : ''}`, erpHeaders(token)),
  applyStudentLeave: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/student-leave', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  approveStudentLeave: (token: string, id: string, approved: boolean) =>
    apiFetch(`/school-erp/student-leave/${id}`, { method: 'PATCH', body: JSON.stringify({ approved }), ...erpHeaders(token) }),
  promoteStudents: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/promotions', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listAlumni: (token: string) => apiFetch('/school-erp/alumni', erpHeaders(token)),
  markAlumni: (token: string, candidateId: string, body: Record<string, unknown>) =>
    apiFetch(`/school-erp/alumni/${candidateId}`, { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listCertificates: (token: string, candidateId?: string) =>
    apiFetch(`/school-erp/certificates${candidateId ? `?candidateId=${candidateId}` : ''}`, erpHeaders(token)),
  issueCertificate: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/certificates', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listGradingConfigs: (token: string) => apiFetch('/school-erp/grading-configs', erpHeaders(token)),
  upsertGradingConfig: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/grading-configs', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  listVehicles: (token: string) => apiFetch('/school-erp/transport/vehicles', erpHeaders(token)),
  createVehicle: (token: string, body: Record<string, unknown>) =>
    apiFetch('/school-erp/transport/vehicles', { method: 'POST', body: JSON.stringify(body), ...erpHeaders(token) }),
  driverRoute: (token: string, phone: string) =>
    apiFetch(`/school-erp/transport/driver-route?phone=${encodeURIComponent(phone)}`, erpHeaders(token)),
  listSuppliers: (token: string) => apiFetch('/school-erp/inventory/suppliers', erpHeaders(token)),
  listPurchaseOrders: (token: string) => apiFetch('/school-erp/inventory/purchase-orders', erpHeaders(token)),
  detectTimetableClashes: (token: string) => apiFetch('/school-erp/timetable/clashes', erpHeaders(token)),
  notifyAbsent: (token: string, batchId: string, date: string) =>
    apiFetch('/school-erp/notifications/absent-alert', { method: 'POST', body: JSON.stringify({ batchId, date }), ...erpHeaders(token) }),
  notifyFeeDefaulters: (token: string) =>
    apiFetch('/school-erp/notifications/fee-reminder', { method: 'POST', ...erpHeaders(token) }),
};

export const publicAdmissionApi = {
  getSchoolInfo: (tenantSlug: string) =>
    apiFetch<{ found: boolean; name?: string; logoUrl?: string }>(`/public/admission/${tenantSlug}/info`),
  submitEnquiry: (tenantSlug: string, body: Record<string, string>) =>
    apiFetch(`/public/admission/${tenantSlug}/enquiry`, { method: 'POST', body: JSON.stringify(body) }),
  submitApplication: (tenantSlug: string, body: Record<string, unknown>) =>
    apiFetch(`/public/admission/${tenantSlug}/apply`, { method: 'POST', body: JSON.stringify(body) }),
};

export const tenantsApi = {
  list: (token: string, page = 1) => apiFetch(`/tenants?page=${page}`, authHeaders(token)),
  create: (token: string, body: { name: string; slug: string; domain?: string }) =>
    apiFetch('/tenants', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  get: (token: string, id: string) => apiFetch(`/tenants/${id}`, authHeaders(token)),
  getMyBranding: (token: string) =>
    apiFetch<{ id: string; name: string; branding?: { primaryColor?: string } }>(
      '/tenants/me/branding',
      authHeaders(token),
    ),
  updateBranding: (token: string, id: string, branding: unknown) =>
    apiFetch(`/tenants/${id}/branding`, {
      method: 'PATCH',
      body: JSON.stringify(branding),
      ...authHeaders(token),
    }),
};

export { isAdmin, isCandidate, normalizeRoles };

