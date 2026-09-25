// When a job was posted, from the page's schema.org JobPosting. Read before
// cleanHtml strips <script>, where JSON-LD lives. Same shape as
// shared/jobPosting.ts, which the extension's dates go through.
import { load } from "cheerio";

export type JobPosting = {
  postedAt?: string;
  postedAtSource?: "json-ld" | "page";
  postedOrEarlier?: true;
  reposted?: true;
  validThrough?: string;
};

const DAY_MS = 86400000;

function isoDay(value: unknown, notAfter?: number): string | null {
  const day = typeof value === "string" ? value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0] : undefined;
  if (!day) return null;
  const time = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== day) return null;
  if (time < Date.UTC(2000, 0, 1) || (notAfter !== undefined && time > notAfter)) return null;
  return day;
}

function jobPostings(data: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const queue: unknown[] = Array.isArray(data) ? [...data] : [data];
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (Array.isArray(record["@graph"])) queue.push(...record["@graph"]);
    const type = record["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) found.push(record);
  }
  return found;
}

export function postingFromHtml(html: string, now = Date.now()): JobPosting | undefined {
  const $ = load(html);
  for (const script of $("script[type='application/ld+json']").toArray()) {
    let data: unknown;
    try {
      data = JSON.parse($(script).text());
    } catch {
      continue; // Malformed JSON-LD is common
    }
    const job = jobPostings(data)[0];
    if (!job) continue;
    const posting: JobPosting = {};
    // A day of slack for time zones
    const postedAt = isoDay(job.datePosted, now + DAY_MS);
    if (postedAt) {
      posting.postedAt = postedAt;
      posting.postedAtSource = "json-ld";
    }
    const validThrough = isoDay(job.validThrough);
    if (validThrough) posting.validThrough = validThrough;
    return posting.postedAt ? posting : undefined;
  }
  return undefined;
}
