import { NextRequest, NextResponse } from 'next/server';
import { fetchWithColdStartRetry } from '@/lib/cold-start-retry';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookies';

const API_BASE = (
  process.env.API_PROXY_URL
  || (process.env.NODE_ENV === 'production' ? 'https://cbt-api-ktkr.onrender.com' : 'http://localhost:4000')
).replace(/\/$/, '');

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/');
  const targetUrl = `${API_BASE}/api/v1/${path}${req.nextUrl.search}`;

  const contentType = req.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  const hopByHop = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'content-encoding',
    'expect',
    'keep-alive',
    'upgrade',
    'proxy-connection',
  ]);

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (hopByHop.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  if (!headers.has('authorization')) {
    const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    if (accessToken) {
      headers.set('authorization', `Bearer ${accessToken}`);
    }
  }

  let requestBody: BodyInit | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestBody = isMultipart ? await req.arrayBuffer() : await req.text();
  }

  const isLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(API_BASE);

  let upstream: Response;
  try {
    const fetchInit = { method: req.method, headers, body: requestBody, cache: 'no-store' as RequestCache };
    upstream = isLocalApi
      ? await fetch(targetUrl, fetchInit)
      : await fetchWithColdStartRetry(targetUrl, fetchInit);
  } catch (err) {
    const devDetail = process.env.NODE_ENV === 'development' && err instanceof Error
      ? err.message
      : null;
    return NextResponse.json(
      {
        success: false,
        error: {
          message: devDetail
            ?? 'API is waking up (free tier). Wait 30–60 seconds, then try again.',
        },
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get('content-type');
  if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) responseHeaders.set('content-disposition', disposition);

  const isBinary = upstreamContentType?.includes('application/pdf')
    || upstreamContentType?.includes('octet-stream')
    || disposition?.includes('inline')
    || disposition?.includes('attachment');

  const responseBody = isBinary ? await upstream.arrayBuffer() : await upstream.text();

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}
