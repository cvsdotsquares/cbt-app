/** Exponential backoff delays for Render free-tier cold starts (total ~41s max). */
export const COLD_START_DELAYS_MS = [2_000, 4_000, 8_000, 12_000, 15_000] as const;
export const COLD_START_MAX_ATTEMPTS = COLD_START_DELAYS_MS.length;

function isRetryableStatus(status: number, raw: string): boolean {
  if (status >= 502 || status === 503) return true;
  const trimmed = raw.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

export function isLocalApiBase(baseUrl: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl.replace(/\/$/, ''));
}

/** Same-origin `/api/v1` proxy — never cold-start retry (local dev or Vercel → Render). */
function isSameOriginApiProxy(url: string): boolean {
  return url.startsWith('/api/');
}

function resolveRequestOrigin(url: string): string | null {
  if (isSameOriginApiProxy(url)) {
    if (typeof window !== 'undefined') return window.location.origin;
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Render free-tier wake-up retries — production remote API only. */
export function shouldUseColdStartRetry(url: string): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (isSameOriginApiProxy(url)) return false;
  const origin = resolveRequestOrigin(url);
  if (origin && isLocalApiBase(origin)) return false;
  return true;
}

export async function fetchWithColdStartRetry(
  url: string,
  init: RequestInit,
  isRetryable: (status: number, raw: string) => boolean = isRetryableStatus,
): Promise<Response> {
  const origin = resolveRequestOrigin(url);
  if (isSameOriginApiProxy(url) || (origin && isLocalApiBase(origin))) {
    return fetch(url, { ...init, cache: 'no-store' });
  }

  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < COLD_START_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { ...init, cache: 'no-store' });
      lastResponse = response;
      if (response.ok) return response;
      const raw = await response.clone().text();
      if (!isRetryable(response.status, raw) || attempt === COLD_START_MAX_ATTEMPTS - 1) {
        return response;
      }
    } catch {
      if (attempt === COLD_START_MAX_ATTEMPTS - 1) throw new Error('upstream unavailable');
    }
    await new Promise((resolve) => setTimeout(resolve, COLD_START_DELAYS_MS[attempt]));
  }
  return lastResponse!;
}
