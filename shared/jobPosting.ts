// When a job was posted, as the browser extension read it from the page
// (extension/src/extract.js). Stored on the job application; the ghost-job
// signals are built from it. Clients write it, so every reader sanitizes.

export type JobPosting = {
  // YYYY-MM-DD
  postedAt?: string;
  // schema.org datePosted, or the page's own "2 weeks ago"
  postedAtSource?: "json-ld" | "page";
  // The page said "30+ days ago": posted on postedAt or before
  postedOrEarlier?: true;
  // The page says "Reposted"
  reposted?: true;
  // YYYY-MM-DD, schema.org validThrough
  validThrough?: string;
};

const DAY_MS = 86400000;

function isoDay(value: unknown, { notAfter }: { notAfter?: number } = {}): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
  if (time < Date.UTC(2000, 0, 1)) return null;
  if (notAfter !== undefined && time > notAfter) return null;
  return value;
}

/** The valid fields of an untrusted posting, or undefined when none are. */
export function sanitizeJobPosting(value: unknown, now = Date.now()): JobPosting | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;
  const posting: JobPosting = {};

  // A day of slack for time zones
  const postedAt = isoDay(data.postedAt, { notAfter: now + DAY_MS });
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
