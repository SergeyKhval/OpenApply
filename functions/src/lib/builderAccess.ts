import { HttpsError } from "firebase-functions/v2/https";

// Who may import resumes into the builder before the rollout, and how often.
//
// Access: admins (users/{uid}.admin) plus an optional BUILDER_ALLOWED_UIDS
// list (comma-separated), read at runtime. The app's resume-builder flag
// only hides the entry points; this is what keeps the callable closed.
//
// Limits: every attempt costs a Gemini call (~$0.01) whether or not the
// user keeps the result, so every attempt counts, per account, plus a
// global daily cap (~$3/day at 300).
export const IMPORT_HOURLY_LIMIT = 5;
export const IMPORT_DAILY_LIMIT = 15;
export const IMPORT_DAILY_GLOBAL_LIMIT = 300;

export function builderAllowlist(): Set<string> {
  return new Set(
    (process.env.BUILDER_ALLOWED_UIDS ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean),
  );
}

/** Throws permission-denied, with a neutral message, for anyone not yet allowed. */
export function assertBuilderAllowed(uid: string, isAdmin: boolean, allowlist = builderAllowlist()): void {
  if (!isAdmin && !allowlist.has(uid)) {
    throw new HttpsError("permission-denied", "This isn't available on your account yet.", { code: "not_available" });
  }
}

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
