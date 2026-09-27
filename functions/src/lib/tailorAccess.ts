import { HttpsError } from "firebase-functions/v2/https";

// How often anyone may create tailored resumes. Open to every signed-in
// user; these limits are what keep the cost bounded.
//
// Limits: a run where no edit survives the checks is free to the user but
// still costs us a Gemini call (~$0.04), so every attempt counts, per
// account, plus a global daily cap on total spend (~$8/day at 200).
export const TAILOR_HOURLY_LIMIT = 10;
export const TAILOR_DAILY_LIMIT = 30;
export const TAILOR_DAILY_GLOBAL_LIMIT = 200;

/** Throws resource-exhausted when any counter is already at its limit. */
export function assertTailorWithinLimits(counts: { hourly: number; daily: number; global: number }): void {
  if (counts.global >= TAILOR_DAILY_GLOBAL_LIMIT) {
    throw new HttpsError("resource-exhausted", "Tailored versions are busy today. Try again tomorrow.", {
      code: "rate_limited",
    });
  }
  if (counts.hourly >= TAILOR_HOURLY_LIMIT) {
    throw new HttpsError("resource-exhausted", "You've made a lot of tailored versions this hour. Try again later.", {
      code: "rate_limited",
    });
  }
  if (counts.daily >= TAILOR_DAILY_LIMIT) {
    throw new HttpsError("resource-exhausted", "You've hit today's limit for tailored versions. Come back tomorrow.", {
      code: "rate_limited",
    });
  }
}
