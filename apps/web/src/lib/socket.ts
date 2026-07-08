import { io, Socket } from 'socket.io-client';

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
    if (hostname.endsWith('.vercel.app')) {
      return 'wss://cbt-api-ktkr.onrender.com';
    }
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${hostname}`;
  }

  return 'http://localhost:4000';
}

let proctoringSocket: Socket | null = null;
let examSocket: Socket | null = null;
let cachedWsAuth: { token: string; tenantId: string; role: string } | null = null;

async function fetchWsAuth() {
  const res = await fetch('/api/auth/ws-token', { credentials: 'include' });
  if (!res.ok) throw new Error('Not authenticated');
  const data = await res.json();
  const role = data.role || 'candidate';
  cachedWsAuth = {
    token: data.token as string,
    tenantId: (data.tenantId as string) || 'default',
    role,
  };
  return cachedWsAuth;
}

async function socketAuth() {
  if (cachedWsAuth) return cachedWsAuth;
  return fetchWsAuth();
}

function applySocketAuth(socket: Socket, auth: { token: string; tenantId: string; role: string }) {
  socket.auth = auth;
}

export function getProctoringSocket(): Socket {
  if (proctoringSocket) {
    void socketAuth().then((auth) => applySocketAuth(proctoringSocket!, auth));
    return proctoringSocket;
  }

  proctoringSocket = io(`${getWsUrl()}/proctoring`, {
    auth: { token: '', tenantId: 'default', role: 'admin' },
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
  });

  proctoringSocket.on('connect_error', () => {
    cachedWsAuth = null;
    void socketAuth().then((auth) => applySocketAuth(proctoringSocket!, auth));
  });

  void socketAuth().then((auth) => applySocketAuth(proctoringSocket!, auth));

  return proctoringSocket;
}

export function getExamSocket(): Socket {
  if (examSocket) {
    void socketAuth().then((auth) => applySocketAuth(examSocket!, auth));
    return examSocket;
  }

  examSocket = io(`${getWsUrl()}/exam`, {
    auth: { token: '', tenantId: 'default', role: 'candidate' },
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
  });

  examSocket.on('connect_error', () => {
    cachedWsAuth = null;
    void socketAuth().then((auth) => applySocketAuth(examSocket!, auth));
  });

  void socketAuth().then((auth) => applySocketAuth(examSocket!, auth));

  return examSocket;
}

export function disconnectExamSocket() {
  examSocket?.disconnect();
  examSocket = null;
}

export function disconnectSockets() {
  proctoringSocket?.disconnect();
  proctoringSocket = null;
  cachedWsAuth = null;
  disconnectExamSocket();
}
