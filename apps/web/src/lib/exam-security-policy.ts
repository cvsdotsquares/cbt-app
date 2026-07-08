import type { ExamSecurityPolicy } from '@cbt/shared';

type RawSecurityPolicy = Partial<ExamSecurityPolicy> & {
  fullscreenRequired?: boolean;
};

/** Browser fullscreen element (standard + webkit). */
export function getFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isFullscreenActive(): boolean {
  return !!getFullscreenElement();
}

export function normalizeSecurityPolicy(
  raw?: RawSecurityPolicy | null,
): ExamSecurityPolicy {
  const defaults: ExamSecurityPolicy = {
    fullscreen: true,
    blockCopyPaste: true,
    blockRightClick: true,
    blockPrint: true,
    detectDevTools: true,
    detectScreenCapture: true,
    detectVirtualMachine: false,
    detectVpn: false,
    watermark: { enabled: false, content: 'email', opacity: 0.06 },
    allowedBrowsers: [],
    proctoringEnabled: true,
    faceVerificationRequired: false,
    riskScoreThreshold: 70,
  };

  if (!raw) return defaults;

  const fullscreen = raw.fullscreen !== undefined
    ? raw.fullscreen
    : raw.fullscreenRequired !== undefined
      ? raw.fullscreenRequired
      : defaults.fullscreen;

  return {
    ...defaults,
    ...raw,
    fullscreen,
    watermark: { ...defaults.watermark, ...(raw.watermark ?? {}) },
  };
}

export async function requestDocumentFullscreen(): Promise<boolean> {
  if (isFullscreenActive()) return true;

  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  const request = el.requestFullscreen?.bind(el)
    ?? el.webkitRequestFullscreen?.bind(el)
    ?? el.msRequestFullscreen?.bind(el);

  if (!request) return false;

  try {
    await request();
    return isFullscreenActive();
  } catch {
    return false;
  }
}

export async function exitDocumentFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };

  const exit = document.exitFullscreen?.bind(document)
    ?? doc.webkitExitFullscreen?.bind(document)
    ?? doc.msExitFullscreen?.bind(document);

  if (!exit || !isFullscreenActive()) return;

  try {
    await exit();
  } catch {
    /* ignore */
  }
}
