// The stable URL of a job posting, so the same job pasted with different
// tracking params or anchors maps to one cached `jobs` doc. Mirrors
// canonicalJobUrl in extension/src/links.js. Source tags (gh_src,
// lever-source) stay: they can carry referral credit for the applicant.

const TRACKING_PARAMS = [
  /^utm_/i, /^gclid$/i, /^fbclid$/i, /^msclkid$/i, /^mc_[a-z]+$/i, /^_hs[a-z]+$/i,
  /^trk$/i, /^trkInfo$/i, /^refId$/i, /^trackingId$/i, /^lipi$/i, /^ebp$/i,
];

export function canonicalJobUrl(href: string): string | null {
  let url: URL;
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
