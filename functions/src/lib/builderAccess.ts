import { HttpsError } from "firebase-functions/v2/https";

// How often anyone may import resumes into the builder. Open to every
// signed-in user; these limits are what keep the cost bounded.
//
// Limits: every attempt costs a Gemini call (~$0.01) whether or not the
// user keeps the result, so every attempt counts, per account, plus a
// global daily cap (~$3/day at 300).
export const IMPORT_HOURLY_LIMIT = 5;
export const IMPORT_DAILY_LIMIT = 15;
export const IMPORT_DAILY_GLOBAL_LIMIT = 300;

/** Throws resource-exhausted when any counter is already at its limit. */
export function assertImportWithinLimits(counts: { hourly: number; daily: number; global: number }): void {
  if (counts.global >= IMPORT_DAILY_GLOBAL_LIMIT) {
    throw new HttpsError("resource-exhausted", "Resume imports are busy today. Try again tomorrow, or start from scratch.", {
      code: "rate_limited",
    });
  }
  if (counts.hourly >= IMPORT_HOURLY_LIMIT || counts.daily >= IMPORT_DAILY_LIMIT) {
    throw new HttpsError("resource-exhausted", "You've imported a lot of resumes today. Try again later, or start from scratch.", {
      code: "rate_limited",
    });
  }
}
