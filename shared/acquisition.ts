// First-touch acquisition capture, shared by the Astro landing and the SPA.
// Both are served from the same origin, so they share this localStorage key
// and whichever loads first records the visit.

export const ACQUISITION_STORAGE_KEY = "openapply_first_touch";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const MAX_VALUE_LENGTH = 200;

export type Acquisition = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  referrer_host?: string;
  landing_path: string;
  captured_at: string;
};

type AcquisitionStorage = Pick<Storage, "getItem" | "setItem">;

function truncate(value: string): string {
  return value.slice(0, MAX_VALUE_LENGTH);
}

function externalReferrerHost(referrer: string, currentHost: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname;
    return host && host !== currentHost ? truncate(host) : undefined;
  } catch {
    return undefined;
  }
}

export function buildAcquisition(url: URL, referrer: string, now: Date): Acquisition {
  const acquisition: Acquisition = {
    landing_path: truncate(url.pathname),
    captured_at: now.toISOString(),
  };

  for (const param of UTM_PARAMS) {
    const value = url.searchParams.get(param)?.trim();
    if (value) acquisition[param] = truncate(value);
  }

  const referrerHost = externalReferrerHost(referrer, url.hostname);
  if (referrerHost) acquisition.referrer_host = referrerHost;

  return acquisition;
}

export function readAcquisition(storage: AcquisitionStorage): Acquisition | null {
  try {
    const raw = storage.getItem(ACQUISITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.landing_path === "string" ? parsed : null;
  } catch {
    return null;
  }
}

// Records the first visit only; later visits keep the original first touch.
export function captureFirstTouch(
  storage: AcquisitionStorage,
  url: URL,
  referrer: string,
  now = new Date(),
): Acquisition | null {
  const existing = readAcquisition(storage);
  if (existing) return existing;

  const acquisition = buildAcquisition(url, referrer, now);
  try {
    storage.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(acquisition));
  } catch {
    // Storage can be blocked (private mode, disabled cookies); skip silently.
  }
  return acquisition;
}

export function captureFirstTouchInBrowser(): void {
  try {
    captureFirstTouch(window.localStorage, new URL(window.location.href), document.referrer);
  } catch {
    // Accessing localStorage itself can throw when storage is blocked.
  }
}

export function readAcquisitionFromBrowser(): Acquisition | null {
  try {
    return readAcquisition(window.localStorage);
  } catch {
    return null;
  }
}
