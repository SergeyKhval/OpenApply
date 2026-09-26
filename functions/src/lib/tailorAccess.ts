import { HttpsError } from "firebase-functions/v2/https";

// Who may create tailored resumes before the rollout, and how often.
//
// Access: admins (users/{uid}.admin, as backfillJobSignals checks) plus an
// optional TAILOR_ALLOWED_UIDS list (comma-separated), read at runtime so a
// deploy without it still works. The app's tailored-resume flag only hides
// the button; this is what actually keeps the callable closed.
//
// Limits: a run where no edit survives the checks is free to the user but
// still costs us a Gemini call (~$0.04), so every attempt counts, per
// account, plus a global daily cap on total spend (~$8/day at 200).
export const TAILOR_HOURLY_LIMIT = 10;
export const TAILOR_DAILY_LIMIT = 30;
export const TAILOR_DAILY_GLOBAL_LIMIT = 200;

export function tailorAllowlist(): Set<string> {
  return new Set(
    (process.env.TAILOR_ALLOWED_UIDS ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean),
  );
}

/** Throws permission-denied, with a neutral message, for anyone not yet allowed. */
export function assertTailorAllowed(uid: string, isAdmin: boolean, allowlist = tailorAllowlist()): void {
  if (!isAdmin && !allowlist.has(uid)) {
    throw new HttpsError("permission-denied", "This isn't available on your account yet.", { code: "not_available" });
  }
}

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
