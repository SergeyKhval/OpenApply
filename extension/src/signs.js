// Posting signals, worded for the popup. Mirrors spa/src/lib/jobSignals.ts
// (signLines); both run the cases in shared/jobSignalsCases.json, so the
// popup and the app say the same thing. Counts, dates and sources only, never
// a verdict. Red only for 3+ reports of being asked to pay.

const DAY_MS = 86400000;
const OLD_POSTING_DAYS = 60;
const REPORT_THRESHOLD = 3;
const REPORT_WINDOW_DAYS = 180;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const REPORT_WORDING = {
  asked_for_money: "reported being asked to pay (for equipment, training or a check)",
  no_reply_30d: "reported no reply 30+ days after applying",
  reposted_after_rejection: "reported seeing it reposted after being rejected",
  filled_still_listed: "reported being told the role was filled or on hold while it stayed listed",
};

/** @param {unknown} value */
function parseDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const monthYear = (date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
const dayMonth = (date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
const fullDay = (date) => `${dayMonth(date)}, ${date.getUTCFullYear()}`;
const todayUtc = (now) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
const daysSince = (date, now) => Math.floor((todayUtc(now).getTime() - date.getTime()) / DAY_MS);
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** @param {number} days */
function spanLabel(days) {
  const months = Math.round(days / 30.44);
  if (months < 24) return plural(months, "month", "months");
  return plural(Math.round(months / 12), "year", "years");
}

function reportLines(reports, now) {
  if (!reports) return [];
  const from = todayUtc(now).getTime() - REPORT_WINDOW_DAYS * DAY_MS;
  const lines = [];
  for (const reason of ["asked_for_money", "no_reply_30d", "reposted_after_rejection", "filled_still_listed"]) {
    const days = (reports[reason]?.days ?? []).map(parseDay).filter((date) => date && date.getTime() >= from);
    if (days.length < REPORT_THRESHOLD) continue;
    const latest = days.reduce((a, b) => (a > b ? a : b));
    lines.push({
      type: `report_${reason}`,
      text: `${days.length} people ${REPORT_WORDING[reason]} (latest ${dayMonth(latest)})`,
      source: "Reports from people who saved this job on OpenApply",
      tone: reason === "asked_for_money" ? "red" : "amber",
    });
  }
  return lines;
}

/**
 * @param {{ signs?: any, reports?: any, reportsHidden?: boolean, hidden?: boolean } | null | undefined} doc
 * @param {string} companyName
 * @param {Date} now
 * @returns {{ type: string, text: string, source: string, tone: "amber" | "red" }[]}
 */
export function signLines(doc, companyName, now) {
  if (!doc || doc.hidden) return [];
  const lines = doc.reportsHidden ? [] : reportLines(doc.reports, now);
  const signs = doc.signs;
  if (!signs) return lines;

  const since = signs.stillListed && parseDay(signs.stillListed.since);
  const lastListed = signs.stillListed && parseDay(signs.stillListed.lastListedAt);
  if (since && lastListed) {
    const days = Math.floor((lastListed.getTime() - since.getTime()) / DAY_MS);
    lines.push({
      type: "still_listed",
      text: `Still listed ${spanLabel(days)} after it was first saved on OpenApply (${monthYear(since)})`,
      source: `Saves and OpenApply's weekly check, last seen listed ${dayMonth(lastListed)}`,
      tone: "amber",
    });
  }

  // JSON-LD only: dates read off the page text haven't passed the precision gate
  const posted = signs.postedAtSource === "json-ld" ? parseDay(signs.postedAt) : null;
  if (posted && daysSince(posted, now) >= OLD_POSTING_DAYS) {
    lines.push({
      type: "posted",
      text: `First posted ${spanLabel(daysSince(posted, now))} ago (${fullDay(posted)})`,
      source: "The posting's own date (schema.org datePosted)",
      tone: "amber",
    });
  }

  const refreshedFrom = signs.dateRefreshed && parseDay(signs.dateRefreshed.from);
  const refreshedTo = signs.dateRefreshed && parseDay(signs.dateRefreshed.to);
  if (refreshedFrom && refreshedTo) {
    lines.push({
      type: "date_refreshed",
      text: `Posted date moved from ${fullDay(refreshedFrom)} to ${fullDay(refreshedTo)}`,
      source: "The posting's own date, read on two different days",
      tone: "amber",
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
      tone: "amber",
    });
  }

  if (signs.openApplication) {
    lines.push({
      type: "open_application",
      text: "Open application, not a specific opening",
      source: "The job title",
      tone: "amber",
    });
  }
  return lines;
}
