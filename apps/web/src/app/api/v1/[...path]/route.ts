import { NextRequest, NextResponse } from 'next/server';
import { fetchWithColdStartRetry } from '@/lib/cold-start-retry';

const API_BASE = (process.env.API_PROXY_URL || 'https://cbt-api-ktkr.onrender.com').replace(/\/$/, '');

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/');
  const targetUrl = `${API_BASE}/api/v1/${path}${req.nextUrl.search}`;

  const contentType = req.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'connection') return;
    // Let fetch compute content-length for multipart/binary bodies
    if (lower === 'content-length' && isMultipart) return;
    headers.set(key, value);
  });

  let requestBody: BodyInit | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestBody = isMultipart ? await req.arrayBuffer() : await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetchWithColdStartRetry(targetUrl, {
      method: req.method,
      headers,
      body: requestBody,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'API is waking up (free tier). Wait 30–60 seconds, then try again.' } },
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
