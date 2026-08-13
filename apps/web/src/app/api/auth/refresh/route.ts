import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_FLAG_COOKIE,
  ADMIN_FLAG_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
  verifyAccessToken,
} from '@/lib/auth-cookies';
import { isAdmin, normalizeRoles } from '@/lib/roles';

const API_BASE = (
  process.env.API_PROXY_URL
  || process.env.NEXT_PUBLIC_API_URL
  || (process.env.NODE_ENV === 'production' ? 'https://cbt-api-ktkr.onrender.com' : 'http://localhost:4000')
).replace(/\/$/, '');

function clientIp(req: NextRequest): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return req.headers.get('cf-connecting-ip') ?? undefined;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'default';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId,
  };
  const ip = clientIp(req);
  if (ip) {
    headers['X-Forwarded-For'] = ip;
    headers['X-Real-IP'] = ip;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json({ error: 'API unavailable' }, { status: 502 });
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const res = NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
    const clear = clearCookieOptions();
    res.cookies.set(ACCESS_TOKEN_COOKIE, '', clear);
    res.cookies.set(REFRESH_TOKEN_COOKIE, '', clear);
    res.cookies.set(AUTH_FLAG_COOKIE, '', clear);
    res.cookies.set(ADMIN_FLAG_COOKIE, '', clear);
    return res;
  }

  const payload = data.data ?? data;
  const accessToken = payload.accessToken as string;
  const newRefreshToken = payload.refreshToken as string;

  if (!accessToken || !newRefreshToken) {
    return NextResponse.json({ error: 'Invalid refresh response' }, { status: 502 });
  }

  const verified = await verifyAccessToken(accessToken);
  if (!verified?.sub) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 502 });
  }

  const roles = normalizeRoles(verified.roles);
  const admin = isAdmin(roles);

  const res = NextResponse.json({
    accessToken,
    refreshToken: newRefreshToken,
    user: payload.user,
    isAdmin: admin,
  });

  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions());
  res.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, refreshCookieOptions());
  res.cookies.set(AUTH_FLAG_COOKIE, '1', refreshCookieOptions());
  res.cookies.set(ADMIN_FLAG_COOKIE, admin ? '1' : '0', refreshCookieOptions());

  return res;
}
