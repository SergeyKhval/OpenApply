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
 * "Save to OpenApply": the landing page parses the link, then the app asks
 * signed-out users to sign up with the job pending.
 * @param {string} jobUrl canonical posting URL
 */
export function saveUrl(jobUrl) {
  const params = new URLSearchParams({ url: jobUrl, ...UTM, utm_medium: "save" });
  return `${SITE_ORIGIN}/save?${params}`;
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
