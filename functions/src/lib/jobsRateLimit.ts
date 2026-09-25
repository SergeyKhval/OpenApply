import { HttpsError } from "firebase-functions/v2/https";

// Abuse limits for the public jobs endpoint: each new URL or pasted
// description costs a Puppeteer scrape and/or a Gemini parse downstream. A
// cache hit (the URL was already scraped) is exempt from these: it costs one
// indexed Firestore read, so it is never rate limited.
//
// Picked from real PostHog volume for lp_job_parse_started over the 30 days
// before this was written: 5 submissions total, single-day peak of 4. The
// product is pre-launch, so these leave generous headroom over observed use
// while bounding a scripted abuser's worst case.
export const HOURLY_LIMIT_PER_CLIENT = 5;
export const DAILY_LIMIT_PER_CLIENT = 10;
export const DAILY_GLOBAL_LIMIT = 100;

/**
 * Throws resource-exhausted if any counter is already at its limit.
 */
export function assertJobsWithinLimits(counts: {
  hourly: number;
  daily: number;
  global: number;
}): void {
  if (counts.global >= DAILY_GLOBAL_LIMIT) {
    throw new HttpsError(
      "resource-exhausted",
      "We hit today's limit for new job lookups. Try again tomorrow.",
    );
  }
  if (counts.hourly >= HOURLY_LIMIT_PER_CLIENT) {
    throw new HttpsError(
      "resource-exhausted",
      "You've submitted a lot of jobs this hour. Take a break and try again later.",
    );
  }
  if (counts.daily >= DAILY_LIMIT_PER_CLIENT) {
    throw new HttpsError(
      "resource-exhausted",
      "You've hit today's limit for new job lookups. Come back tomorrow.",
    );
  }
}
