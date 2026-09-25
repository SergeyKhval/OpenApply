// One key per job posting, so signals about a job line up whichever link
// people saved it from. ATS job ids where the link has one, else the
// canonical URL. Mirrors extension/src/jobKey.js; both run the cases in
// shared/jobKeyCases.json.
import { canonicalJobUrl } from "./links.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @param {URL} url @returns {string | null} */
function atsKey(url) {
  const host = url.hostname;
  const segments = url.pathname.split("/").filter(Boolean);
  const param = (name) => url.searchParams.get(name);

  // Company career sites embed Greenhouse and Ashby boards with a job id param
  const ghJid = param("gh_jid");
  if (ghJid && /^\d+$/.test(ghJid)) return `greenhouse:${ghJid}`;
  const ashbyJid = param("ashby_jid");
  if (ashbyJid && UUID.test(ashbyJid)) return `ashby:${ashbyJid.toLowerCase()}`;

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const id = segments.includes("jobs") ? segments[segments.indexOf("jobs") + 1] : param("token");
    if (id && /^\d+$/.test(id)) return `greenhouse:${id}`;
  }

  if (/(^|\.)lever\.co$/.test(host) && segments[1] && UUID.test(segments[1])) {
    return `lever:${segments[1].toLowerCase()}`;
  }

  if (host === "jobs.ashbyhq.com" && segments[1] && UUID.test(segments[1])) {
    return `ashby:${segments[1].toLowerCase()}`;
  }

  const workday = host.match(/^([^.]+)\.wd\d+\.myworkdayjobs\.com$/);
  if (workday) {
    const at = segments.findIndex((segment) => segment === "job" || segment === "details");
    const last = segments.slice(at + 1).filter((segment) => segment !== "apply").pop();
    const req = last?.match(/_([A-Za-z]*-?\d[\w-]*)$/)?.[1];
    if (at >= 0 && req) return `workday:${workday[1]}:${req}`;
  }

  if (host === "apply.workable.com" && segments[1] === "j" && segments[2]) {
    return `workable:${segments[2]}`;
  }

  if (host === "jobs.smartrecruiters.com") {
    const id = segments[1]?.match(/^(\d+)/)?.[1];
    if (id) return `smartrecruiters:${id}`;
  }

  return null;
}

/**
 * @param {string} href
 * @returns {string | null} null when this isn't an http(s) page
 */
export function jobKey(href) {
  let original;
  try {
    original = new URL(href);
  } catch {
    return null;
  }
  // Job id params (gh_jid, ashby_jid) are read before tracking params go
  const ats = atsKey(original);
  if (ats) return ats;

  const canonical = canonicalJobUrl(href);
  if (!canonical) return null;
  const linkedIn = canonical.match(/^https:\/\/www\.linkedin\.com\/jobs\/view\/(\d+)\/$/);
  if (linkedIn) return `linkedin:${linkedIn[1]}`;
  const indeed = canonical.match(/^https?:\/\/[^/]*indeed\.[a-z.]+\/viewjob\?jk=([a-z0-9]+)$/i);
  if (indeed) return `indeed:${indeed[1]}`;
  return `url:${canonical}`;
}

/**
 * @param {string} key
 * @returns {Promise<string>} sha256, hex
 */
export async function jobKeyHash(key) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// The only part of a key hash the extension sends when it looks a job up
/** @param {string} hash */
export function jobKeyPrefix(hash) {
  return hash.slice(0, 4);
}
