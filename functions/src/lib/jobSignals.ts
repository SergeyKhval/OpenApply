// Ghost-job signals: dated facts about a posting, built from the jobs people
// save. Facts only, never a verdict: "first posted 14 months ago", "posted
// date moved from Jan 2 to Aug 27", "same role under a new id since Nov".
// Pure functions; the trigger in ../jobSignals.ts does the Firestore reads
// and writes. Days are YYYY-MM-DD strings, which is all the precision we show.

export type JobPosting = {
  postedAt?: string;
  postedAtSource?: "json-ld" | "page";
  postedOrEarlier?: true;
  reposted?: true;
  validThrough?: string;
};

// jobSignalsPrivate/{keyHash}: everything the signs are computed from
export type PrivateJobSignals = {
  key: string;
  companyTitleKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
  earliestPostedAt?: string;
  latestPostedAt?: string;
  postedAtSource?: "json-ld" | "page";
  postedOrEarlier?: true;
  repostedOnPage?: true;
  openApplication?: true;
  validThrough?: string;
  // The canonical link, for the weekly listing check
  link?: string;
  // When the weekly check should look at it next; absent once closed or uncheckable
  listingCheckDueAt?: string;
  listing?: ListingHistory;
};

export type ListingHistory = {
  lastCheckedAt?: string;
  // Last day we know it was up: a save, or the check found it
  lastListedAt?: string;
  closedAt?: string;
  // Checks in a row that couldn't tell
  unknownStreak?: number;
};

// jobSignals/{keyHash}.signs: what anyone may read
export type PublicJobSigns = {
  firstSeenAt: string;
  postedAt?: string;
  postedAtSource?: "json-ld" | "page";
  postedOrEarlier?: true;
  dateRefreshed?: { from: string; to: string };
  repostedOnPage?: true;
  openApplication?: true;
  sameRoleReposted?: { count: number; firstSeenAt: string };
  stillListed?: { since: string; lastListedAt: string };
};

export type JobObservation = {
  key: string;
  link?: string;
  company: string;
  title: string;
  posting?: JobPosting;
  seenAt: number;
};

export type SameRoleSighting = { key: string; firstSeenAt: string };

const DAY_MS = 86400000;
// A posted date that moved by less than this is a correction, not a refresh
const REFRESH_MIN_DAYS = 7;
// The same role under a new ATS id this much later is a repost
const REPOST_MIN_DAYS = 30;
// "Still listed" once it's been up this long since the first save
const STILL_LISTED_MIN_DAYS = 60;
const LISTING_CHECK_EVERY_DAYS = 7;

function day(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
}

export function addDays(from: string, days: number): string {
  return day(Date.parse(`${from}T00:00:00Z`) + days * DAY_MS);
}

function isoDay(value: unknown, notAfter?: number): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time) || day(time) !== value) return null;
  if (time < Date.UTC(2000, 0, 1) || (notAfter !== undefined && time > notAfter)) return null;
  return value;
}

/** The valid fields of a client-written posting (shared/jobPosting.ts), or undefined. */
export function sanitizePosting(value: unknown, now = Date.now()): JobPosting | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;
  const posting: JobPosting = {};
  const postedAt = isoDay(data.postedAt, now + DAY_MS);
  const source = data.postedAtSource;
  if (postedAt && (source === "json-ld" || source === "page")) {
    posting.postedAt = postedAt;
    posting.postedAtSource = source;
    if (data.postedOrEarlier === true) posting.postedOrEarlier = true;
  }
  if (data.reposted === true) posting.reposted = true;
  const validThrough = isoDay(data.validThrough);
  if (validThrough) posting.validThrough = validThrough;
  return Object.keys(posting).length ? posting : undefined;
}

const PLACEHOLDERS = new Set(["unknown company", "unknown position"]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\((?:[mfwdx]\s*\/\s*)+[mfwdx]\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "acme|data analyst", or "" when either side is missing. */
export function companyTitleKey(company: string, title: string): string {
  if (PLACEHOLDERS.has(company.trim().toLowerCase()) || PLACEHOLDERS.has(title.trim().toLowerCase())) return "";
  const companyName = normalize(company)
    .replace(/\b(inc|llc|ltd|gmbh|ag|bv|b v|sa|sas|plc|corp|corporation|co|limited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const role = normalize(title);
  return companyName && role ? `${companyName}|${role}` : "";
}

// Only the title: body text matched "talent community" footers on 21 of 23 pages
export function isOpenApplication(title: string): boolean {
  return /\b(open|initiative|general|speculative|unsolicited) application\b|initiativbewerbung|\btalent (pool|community)\b/i
    .test(title);
}

export function observeJob(previous: PrivateJobSignals | undefined, observation: JobObservation): PrivateJobSignals {
  const seen = day(observation.seenAt);
  // Older applications can be recorded after newer ones (on their next edit)
  const next: PrivateJobSignals = previous
    ? {
      ...previous,
      firstSeenAt: seen < previous.firstSeenAt ? seen : previous.firstSeenAt,
      lastSeenAt: seen > previous.lastSeenAt ? seen : previous.lastSeenAt,
    }
    : { key: observation.key, companyTitleKey: "", firstSeenAt: seen, lastSeenAt: seen };
  next.key = observation.key;

  const titleKey = companyTitleKey(observation.company, observation.title);
  if (titleKey) next.companyTitleKey = titleKey;
  if (isOpenApplication(observation.title)) next.openApplication = true;

  if (observation.link) next.link = observation.link;

  // Someone saving it is a sighting of it listed
  const listing: ListingHistory = { ...next.listing };
  if (!listing.lastListedAt || seen > listing.lastListedAt) listing.lastListedAt = seen;
  const reopened = Boolean(listing.closedAt && seen > listing.closedAt);
  if (reopened) delete listing.closedAt;
  next.listing = listing;
  if (!listing.closedAt && (!next.listingCheckDueAt || reopened)) {
    next.listingCheckDueAt = addDays(seen, LISTING_CHECK_EVERY_DAYS);
  }

  const posting = observation.posting;
  if (posting?.reposted) next.repostedOnPage = true;
  if (posting?.validThrough && (!next.validThrough || posting.validThrough > next.validThrough)) {
    next.validThrough = posting.validThrough;
  }

  const postedAt = posting?.postedAt;
  if (postedAt && posting.postedAtSource) {
    if (posting.postedAtSource === "json-ld" && next.postedAtSource !== "json-ld") {
      // schema.org dates beat "2 weeks ago" read off the page
      next.earliestPostedAt = postedAt;
      next.latestPostedAt = postedAt;
      next.postedAtSource = "json-ld";
      delete next.postedOrEarlier;
    } else if (posting.postedAtSource === next.postedAtSource || !next.postedAtSource) {
      next.postedAtSource = posting.postedAtSource;
      if (!next.earliestPostedAt || postedAt < next.earliestPostedAt) next.earliestPostedAt = postedAt;
      if (!next.latestPostedAt || postedAt > next.latestPostedAt) next.latestPostedAt = postedAt;
      if (posting.postedAtSource === "page" && posting.postedOrEarlier) next.postedOrEarlier = true;
    }
  }
  return next;
}

/**
 * The public signs for a job. `sameRole` holds the other jobs saved under the
 * same company and title.
 */
export function publicSigns(signals: PrivateJobSignals, sameRole: SameRoleSighting[]): PublicJobSigns {
  const signs: PublicJobSigns = { firstSeenAt: signals.firstSeenAt };
  if (signals.earliestPostedAt && signals.postedAtSource) {
    signs.postedAt = signals.earliestPostedAt;
    signs.postedAtSource = signals.postedAtSource;
    if (signals.postedOrEarlier) signs.postedOrEarlier = true;
  }
  if (
    signals.postedAtSource === "json-ld" &&
    signals.earliestPostedAt &&
    signals.latestPostedAt &&
    daysBetween(signals.earliestPostedAt, signals.latestPostedAt) >= REFRESH_MIN_DAYS
  ) {
    signs.dateRefreshed = { from: signals.earliestPostedAt, to: signals.latestPostedAt };
  }
  if (signals.repostedOnPage) signs.repostedOnPage = true;
  const listing = signals.listing;
  const closed = Boolean(listing?.closedAt && listing.lastListedAt && listing.closedAt >= listing.lastListedAt);
  if (
    listing?.lastListedAt &&
    !closed &&
    daysBetween(signals.firstSeenAt, listing.lastListedAt) >= STILL_LISTED_MIN_DAYS
  ) {
    signs.stillListed = { since: signals.firstSeenAt, lastListedAt: listing.lastListedAt };
  }
  if (signals.openApplication) signs.openApplication = true;

  // Only ATS job ids prove a new posting; two links to one page don't
  const isAtsKey = (key: string) => !key.startsWith("url:");
  if (isAtsKey(signals.key)) {
    const others = sameRole.filter((sighting) => sighting.key !== signals.key && isAtsKey(sighting.key));
    const concurrent = others.filter(
      (sighting) => Math.abs(daysBetween(sighting.firstSeenAt, signals.firstSeenAt)) < REPOST_MIN_DAYS,
    );
    const older = others.filter(
      (sighting) => daysBetween(sighting.firstSeenAt, signals.firstSeenAt) >= REPOST_MIN_DAYS,
    );
    // Several same-title openings at once is a team hiring, not a repost
    if (older.length && concurrent.length < 2) {
      signs.sameRoleReposted = {
        count: older.length,
        firstSeenAt: older.map((sighting) => sighting.firstSeenAt).sort()[0],
      };
    }
  }
  return signs;
}
