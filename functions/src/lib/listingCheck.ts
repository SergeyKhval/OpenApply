// The weekly check of whether saved jobs are still listed. Only answers it
// can trust: an ATS's public API (open or gone), or a server-rendered page
// that shows the job's title. Client-rendered shells answer 200 either way,
// so they count as unknown, never as listed.
import { addDays, normalize, type PrivateJobSignals } from "./jobSignals";

export type ListingRequest =
  | { kind: "greenhouse-api" | "lever-api" | "page"; url: string }
  | { kind: "ashby-api"; url: string; id: string };

export type ListingState = "listed" | "closed" | "unknown";

const UNKNOWN_CHECKS_BEFORE_GIVING_UP = 4;

// Pages that keep the job's title once it's gone. From the cache hand-check:
// hh.ru and getmatch.ru "вакансия в архиве", boards' "no longer accepting"
const CLOSED_TEXT = new RegExp([
  "no longer (accepting|available|open|active)",
  "(position|job|vacancy|role) (has been |is )?(filled|closed|expired)",
  "(job|posting) (has )?expired",
  "вакансия в архиве",
  "nicht mehr (verfügbar|aktiv)",
  "bereits besetzt",
].join("|"), "i");

// Saved from a careers index rather than a job: nothing to call listed
const INDEX_TITLE = /^(current |open )?(job )?(openings|positions|careers|jobs|vacancies)$/;
const CHECK_EVERY_DAYS = 7;

export function listingRequest(link: string, key: string): ListingRequest | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);

  if (key.startsWith("greenhouse:")) {
    // Company sites embedding the board (gh_jid) don't say which board it is
    const board = /(^|\.)greenhouse\.io$/.test(url.hostname) && segments[1] === "jobs" ? segments[0] : null;
    const id = key.slice("greenhouse:".length);
    return board ? { kind: "greenhouse-api", url: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}` } : null;
  }
  if (key.startsWith("lever:") && /(^|\.)lever\.co$/.test(url.hostname) && segments[0]) {
    const api = url.hostname.includes(".eu.") ? "https://api.eu.lever.co" : "https://api.lever.co";
    return { kind: "lever-api", url: `${api}/v0/postings/${segments[0]}/${key.slice("lever:".length)}` };
  }
  if (key.startsWith("ashby:") && url.hostname === "jobs.ashbyhq.com" && segments[0]) {
    return {
      kind: "ashby-api",
      url: `https://api.ashbyhq.com/posting-api/job-board/${segments[0]}`,
      id: key.slice("ashby:".length),
    };
  }
  // LinkedIn and Indeed forbid crawling; Workday and the rest are shells
  if (key.startsWith("url:") && (url.protocol === "https:" || url.protocol === "http:")) {
    return { kind: "page", url: url.href };
  }
  return null;
}

function withoutQuery(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return href;
  }
}

/**
 * `title` is the normalized title from the job's companyTitleKey. `today`
 * (YYYY-MM-DD) is for a page's schema.org validThrough; `finalUrl` is where
 * the request ended up after redirects.
 */
export function listingState(
  request: ListingRequest,
  status: number,
  body: string,
  title: string,
  { today = new Date().toISOString().slice(0, 10), finalUrl }: { today?: string; finalUrl?: string } = {},
): ListingState {
  if (status === 404 || status === 410) return request.kind === "ashby-api" ? "unknown" : "closed";
  if (status !== 200) return "unknown";
  switch (request.kind) {
  case "greenhouse-api":
  case "lever-api":
    return "listed";
  case "ashby-api":
    return body.toLowerCase().includes(request.id.toLowerCase()) ? "listed" : "closed";
  case "page": {
    if (!title || INDEX_TITLE.test(title)) return "unknown";
    // Closed postings often redirect to the careers page, or to a newer posting
    if (finalUrl && withoutQuery(finalUrl) !== withoutQuery(request.url)) return "unknown";
    const validThrough = body.match(/"validThrough"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1];
    if (validThrough && validThrough < today) return "closed";
    // Shells name the job in <title>; only what the page shows counts
    const visible = body.replace(/<head[\s\S]*?<\/head>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ");
    if (CLOSED_TEXT.test(visible)) return "closed";
    return normalize(visible).includes(title) ? "listed" : "unknown";
  }
  }
}

export function applyListingCheck(signals: PrivateJobSignals, state: ListingState, today: string): PrivateJobSignals {
  const next: PrivateJobSignals = { ...signals, listing: { ...signals.listing, lastCheckedAt: today } };
  const listing = next.listing ?? {};
  if (state === "listed") {
    listing.lastListedAt = today;
    delete listing.closedAt;
    delete listing.unknownStreak;
    next.listingCheckDueAt = addDays(today, CHECK_EVERY_DAYS);
  } else if (state === "closed") {
    listing.closedAt = today;
    delete listing.unknownStreak;
    delete next.listingCheckDueAt;
  } else {
    listing.unknownStreak = (listing.unknownStreak ?? 0) + 1;
    if (listing.unknownStreak >= UNKNOWN_CHECKS_BEFORE_GIVING_UP) delete next.listingCheckDueAt;
    else next.listingCheckDueAt = addDays(today, CHECK_EVERY_DAYS);
  }
  next.listing = listing;
  return next;
}
