// Builds the openapply.app links the popup opens. Pure functions, no chrome.* APIs.

export const SITE_ORIGIN = "https://openapply.app";
export const MIN_DESCRIPTION_CHARS = 200;

const UTM = { utm_source: "extension", utm_campaign: "sprint-2609" };

const TRACKING_PARAMS = [
  /^utm_/i, /^gclid$/i, /^fbclid$/i, /^msclkid$/i, /^mc_[a-z]+$/i, /^_hs[a-z]+$/i,
  /^trk$/i, /^trkInfo$/i, /^refId$/i, /^trackingId$/i, /^lipi$/i, /^ebp$/i,
];

/**
 * The stable URL of a job posting. LinkedIn and Indeed show a job inside a
 * search page (?currentJobId=, ?vjk=); the app's parser needs the posting itself.
 * @param {string} href
 * @returns {string | null} null when this isn't an http(s) page
 */
export function canonicalJobUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname;
  if (/(^|\.)linkedin\.com$/.test(host)) {
    const id = url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d+)/)?.[1]
      ?? url.searchParams.get("currentJobId");
    if (id && /^\d+$/.test(id)) return `https://www.linkedin.com/jobs/view/${id}/`;
  }

  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) {
    const id = url.searchParams.get("jk") ?? url.searchParams.get("vjk");
    if (id && /^[a-z0-9]+$/i.test(id)) return `${url.origin}/viewjob?jk=${id}`;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key);
  }
  // Keep hash routes (#/jobs/123), drop plain anchors
  if (!/^#[/!]/.test(url.hash)) url.hash = "";
  return url.href;
}

/**
 * "Save to OpenApply" when the popup couldn't read the page: the landing page
 * parses the link on the server, then the app asks signed-out users to sign up
 * with the job pending.
 * @param {string} jobUrl canonical posting URL
 */
export function saveUrl(jobUrl) {
  const params = new URLSearchParams({ url: jobUrl, ...UTM, utm_medium: "save" });
  return `${SITE_ORIGIN}/save?${params}`;
}

// Same limits as shared/extensionJob.ts, which decodes the payload on /save
export const JOB_LIMITS = { url: 2000, title: 300, company: 300, location: 300, salary: 200, description: 15000 };

function bytesToBase64Url(bytes) {
  let binary = "";
  // In chunks: spreading a long array into fromCharCode overflows the stack
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The job as a URL-fragment value: base64url(deflate(JSON)).
 * @param {{ url: string, title: string, company: string, location: string, description: string, posting?: import("./extract.js").Posting }} job
 * @returns {Promise<string>}
 */
export async function encodeJob(job) {
  const payload = { v: 1 };
  for (const [key, limit] of Object.entries(JOB_LIMITS)) {
    payload[key] = String(job[key] ?? "").trim().slice(0, limit);
  }
  // Dates the page showed; /save checks them (shared/jobPosting.ts)
  if (job.posting && Object.keys(job.posting).length) payload.posting = job.posting;
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToBase64Url(compressed);
}

/**
 * "Save to OpenApply" with the job the popup read: /save creates the
 * application from the fragment, which the browser never sends to a server,
 * so nothing is scraped and login-gated pages work.
 * @param {{ url: string, title: string, company: string, location: string, description: string, posting?: import("./extract.js").Posting }} job
 * @returns {Promise<string>}
 */
export async function saveJobUrl(job) {
  const query = new URLSearchParams({ ...UTM, utm_medium: "save" });
  const fragment = new URLSearchParams({ job: await encodeJob(job) });
  return `${SITE_ORIGIN}/save?${query}#${fragment}`;
}

/**
 * "Check my resume match": the job description travels in the fragment, which
 * the browser never sends to a server.
 * @param {{ description: string, url: string | null }} job
 */
export function matchUrl({ description, url }) {
  const query = new URLSearchParams({ ...UTM, utm_medium: "match" });
  const fragment = new URLSearchParams({ jd: description });
  if (url) fragment.set("url", url);
  return `${SITE_ORIGIN}/tools/resume-job-match?${query}#${fragment}`;
}

// The prefix-only lookup behind openapply.app/api/job-signals (functions/src/jobSignalsLookup.ts)
/** @param {string} prefix 4 hex characters of the job key hash */
export function signalsLookupUrl(prefix) {
  return `${SITE_ORIGIN}/api/job-signals?p=${encodeURIComponent(prefix)}`;
}

/**
 * Report a posting in the app: it finds the job in the tracker, or offers to save it first.
 * @param {string} hash job key hash
 * @param {string} jobUrl
 */
export function reportUrl(hash, jobUrl) {
  const params = new URLSearchParams({ job: hash, url: jobUrl, ...UTM });
  return `${SITE_ORIGIN}/app/jobs/report?${params}`;
}
