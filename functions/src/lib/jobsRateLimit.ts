import { HttpsError } from "firebase-functions/v2/https";

// Abuse limits for the public jobs endpoint: each new URL or pasted
// description costs a Puppeteer scrape and/or a Gemini parse downstream. A
// cache hit (the URL was already scraped) is exempt from these: it costs one
// indexed Firestore read, so it is never rate limited.
//
// Two tiers, keyed differently in jobs.ts:
// - "ip": anonymous or signed-out callers, keyed by IP. A shared office or
//   university IP, or a burst from one visitor, should still be capped hard.
// - "account": a real signed-in (non-anonymous) user, keyed by uid. A job
//   seeker saving a batch of postings in one evening is normal, so this tier
//   is deliberately looser than the IP tier.
//
// Picked from real PostHog volume for lp_job_parse_started over the 30 days
// before this was written: 5 submissions total, single-day peak of 4. The
// product is pre-launch, so the IP tier leaves generous headroom over
// observed use while bounding a scripted abuser's worst case; the account
// tier leaves room for a real user adding 15-20 jobs in a sitting.
export const HOURLY_LIMIT_PER_IP = 5;
export const DAILY_LIMIT_PER_IP = 10;
export const HOURLY_LIMIT_PER_ACCOUNT = 30;
export const DAILY_LIMIT_PER_ACCOUNT = 100;
export const DAILY_GLOBAL_LIMIT = 300;

export type JobsRateLimitTier = "ip" | "account";

/**
 * Throws resource-exhausted if any counter is already at its limit for the
 * given tier. The global counter is shared across tiers.
 */
export function assertJobsWithinLimits(
  counts: { hourly: number; daily: number; global: number },
  tier: JobsRateLimitTier,
): void {
  const hourlyLimit = tier === "account" ? HOURLY_LIMIT_PER_ACCOUNT : HOURLY_LIMIT_PER_IP;
  const dailyLimit = tier === "account" ? DAILY_LIMIT_PER_ACCOUNT : DAILY_LIMIT_PER_IP;

  if (counts.global >= DAILY_GLOBAL_LIMIT) {
    throw new HttpsError(
      "resource-exhausted",
      "We hit today's limit for new job lookups. Try again tomorrow.",
    );
  }
  if (counts.hourly >= hourlyLimit) {
    throw new HttpsError(
      "resource-exhausted",
      "You've submitted a lot of jobs this hour. Take a break and try again later.",
    );
  }
  if (counts.daily >= dailyLimit) {
    throw new HttpsError(
      "resource-exhausted",
      "You've hit today's limit for new job lookups. Come back tomorrow.",
    );
  }
}
