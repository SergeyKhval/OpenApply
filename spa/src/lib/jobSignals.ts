// Posting signals: dated facts about a saved job's posting, built by the
// jobSignals function (functions/src/lib/jobSignals.ts) into the public
// jobSignals/{jobKeyHash} doc. Wording rule: counts, dates and where the fact
// came from. Never a verdict about the employer.
//
// Only the signs that passed the precision gate (vault
// redesign/ghost-flag-gate-2026-09-25.md) are shown. Dates read off the page
// text and LinkedIn's "Reposted" stay stored but hidden until measured on
// real extension captures.

// Mirrors PublicJobSigns in functions/src/lib/jobSignals.ts
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

export type JobSignalsDoc = {
  signs?: PublicJobSigns;
  // Admin kill switch for one job
  hidden?: boolean;
};

export type SignType = "posted" | "date_refreshed" | "same_role" | "still_listed" | "open_application";

export type SignLine = { type: SignType; text: string; source: string };

const DAY_MS = 86400000;
// A fresh posting date is normal; only an old one is worth a line
const OLD_POSTING_DAYS = 60;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Days are YYYY-MM-DD in UTC; read them as UTC so no time zone shifts a day
function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const monthYear = (date: Date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
const dayMonth = (date: Date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
const fullDay = (date: Date) => `${dayMonth(date)}, ${date.getUTCFullYear()}`;

function todayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function daysSince(date: Date, now: Date): number {
  return Math.floor((todayUtc(now).getTime() - date.getTime()) / DAY_MS);
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "14 months", "2 years", from a span of days (60 or more). */
export function spanLabel(days: number): string {
  const months = Math.round(days / 30.44);
  if (months < 24) return plural(months, "month", "months");
  return plural(Math.round(months / 12), "year", "years");
}

/** The signs to show for a job, most telling first. Empty when there are none. */
export function signLines(doc: JobSignalsDoc | null | undefined, companyName: string, now: Date): SignLine[] {
  if (!doc?.signs || doc.hidden) return [];
  const signs = doc.signs;
  const lines: SignLine[] = [];

  const stillListed = signs.stillListed;
  const since = stillListed && parseDay(stillListed.since);
  const lastListed = stillListed && parseDay(stillListed.lastListedAt);
  if (since && lastListed) {
    const days = Math.floor((lastListed.getTime() - since.getTime()) / DAY_MS);
    lines.push({
      type: "still_listed",
      text: `Still listed ${spanLabel(days)} after it was first saved on OpenApply (${monthYear(since)})`,
      source: `Saves and OpenApply's weekly check, last seen listed ${dayMonth(lastListed)}`,
    });
  }

  // JSON-LD only: page-text dates haven't passed the gate yet
  const posted = signs.postedAtSource === "json-ld" && signs.postedAt ? parseDay(signs.postedAt) : null;
  if (posted && daysSince(posted, now) >= OLD_POSTING_DAYS) {
    lines.push({
      type: "posted",
      text: `First posted ${spanLabel(daysSince(posted, now))} ago (${fullDay(posted)})`,
      source: "The posting's own date (schema.org datePosted)",
    });
  }

  const refreshedFrom = signs.dateRefreshed && parseDay(signs.dateRefreshed.from);
  const refreshedTo = signs.dateRefreshed && parseDay(signs.dateRefreshed.to);
  if (refreshedFrom && refreshedTo) {
    lines.push({
      type: "date_refreshed",
      text: `Posted date moved from ${fullDay(refreshedFrom)} to ${fullDay(refreshedTo)}`,
      source: "The posting's own date, read on two different days",
    });
  }

  const sameRole = signs.sameRoleReposted;
  const sameRoleSince = sameRole && parseDay(sameRole.firstSeenAt);
  if (sameRole && sameRole.count > 0 && sameRoleSince) {
    const company = companyName.trim() || "this company";
    lines.push({
      type: "same_role",
      text: `Same title at ${company} saved under ${plural(sameRole.count, "older job ID", "older job IDs")}, first in ${monthYear(sameRoleSince)}`,
      source: "Jobs saved on OpenApply",
    });
  }

  if (signs.openApplication) {
    lines.push({
      type: "open_application",
      text: "Open application, not a specific opening",
      source: "The job title",
    });
  }
  return lines;
}
