import { createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";

export const MIN_INPUT_CHARS = 200;
export const MAX_RESUME_CHARS = 15000;
export const MAX_JOB_DESCRIPTION_CHARS = 15000;

// Anonymous abuse limits for the public match tool
export const HOURLY_LIMIT_PER_CLIENT = 6;
export const DAILY_LIMIT_PER_CLIENT = 15;
export const DAILY_GLOBAL_LIMIT = 1000;

export type MatchToolInput = {
  resumeText: string;
  jobDescription: string;
};

/**
 * Validates and normalizes the public match tool payload.
 * Throws invalid-argument with a user-facing message on bad input.
 */
export function validateMatchToolInput(data: unknown): MatchToolInput {
  const { resumeText, jobDescription } =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  if (typeof resumeText !== "string" || typeof jobDescription !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Paste both your resume and the job description.",
    );
  }

  const resume = resumeText.trim();
  const job = jobDescription.trim();

  if (resume.length < MIN_INPUT_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      "Your resume looks too short. Paste the full text.",
    );
  }
  if (job.length < MIN_INPUT_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      "The job description looks too short. Paste the full posting.",
    );
  }
  if (resume.length > MAX_RESUME_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      `Your resume is over ${MAX_RESUME_CHARS.toLocaleString("en-US")} characters. Trim it and try again.`,
    );
  }
  if (job.length > MAX_JOB_DESCRIPTION_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      `The job description is over ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString("en-US")} characters. Trim it and try again.`,
    );
  }

  return { resumeText: resume, jobDescription: job };
}

/**
 * Picks the client IP from the request. Google's front end appends the
 * real client IP to X-Forwarded-For, so the last entry cannot be spoofed.
 */
export function getClientIp(rawRequest: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | null {
  const header = rawRequest.headers?.["x-forwarded-for"];
  const value = Array.isArray(header) ? header.join(",") : header;
  const forwarded = value
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (forwarded && forwarded.length > 0) {
    return forwarded[forwarded.length - 1] ?? null;
  }
  return rawRequest.ip || null;
}

/**
 * Hashes a client identifier so raw IPs are never stored.
 */
export function hashClientKey(value: string): string {
  return createHash("sha256")
    .update(`openapply-match-tool:${value}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Returns the Firestore doc ids of the rate limit counters for a request.
 */
export function rateLimitWindows(clientKey: string, now: Date) {
  const iso = now.toISOString();
  const day = iso.slice(0, 10).replace(/-/g, "");
  const hour = `${day}${iso.slice(11, 13)}`;

  return {
    hourly: `client_${clientKey}_${hour}`,
    daily: `client_${clientKey}_${day}`,
    global: `global_${day}`,
  };
}

/**
 * Throws resource-exhausted if any counter is already at its limit.
 */
export function assertWithinLimits(counts: {
  hourly: number;
  daily: number;
  global: number;
}): void {
  if (counts.global >= DAILY_GLOBAL_LIMIT) {
    throw new HttpsError(
      "resource-exhausted",
      "The free tool hit its daily limit. Try again tomorrow, or sign up to run matches in the app.",
    );
  }
  if (counts.hourly >= HOURLY_LIMIT_PER_CLIENT) {
    throw new HttpsError(
      "resource-exhausted",
      "You've run a lot of matches this hour. Take a breather and try again later.",
    );
  }
  if (counts.daily >= DAILY_LIMIT_PER_CLIENT) {
    throw new HttpsError(
      "resource-exhausted",
      "You've hit today's free limit. Come back tomorrow, or sign up to keep going in the app.",
    );
  }
}

export function buildMatchToolPrompt(
  { resumeText, jobDescription }: MatchToolInput,
  today: Date = new Date(),
): string {
  return `Today is ${today.toISOString().slice(0, 10)}. Treat "present" in the resume as today when counting years of experience.

You are a blunt, experienced recruiter who screens hundreds of resumes a week, and you know how resume parsers read text. Compare the resume to the job description and tell the candidate honestly how a screener would see it. Do not flatter.

Hard rule: never rewrite the resume and never invent anything. Do not suggest experience, employers, numbers, or years the resume does not show. Only point at gaps and at existing resume lines.

Return:
- companyName and position: taken from the job description. Use an empty string if not stated.
- parseCheck: judge the resume text itself as a parser would see it. "clean" if it reads in a sensible order. "issues" if some parts are jumbled, merged, or missing (for example dates separated from their jobs, broken bullet points). "scrambled" if columns or text boxes interleave so badly that a screener could not follow it. note: one sentence describing what you saw, or an empty string when clean.
- matchScore: integer 0 to 100 using this rubric. Weight must-have requirements far more than nice-to-haves, and judge by evidence in the resume, not keyword overlap alone.
  85-100: meets nearly every must-have with clear evidence, plus most nice-to-haves.
  70-84: meets most must-haves, with a few gaps.
  50-69: meets some must-haves, with noticeable gaps.
  0-49: missing several must-haves (years of experience, core skills, required credentials).
- verdict: 2 to 3 plain sentences on why a screener would pass on this resume for this job, or why it would get through. Name the biggest gap.
- requirements: the 6 to 10 most important requirements from the job description, must-haves first. For each: status "matched", "partial", or "missing"; importance "must-have" or "nice-to-have" based on how the job description phrases it; evidence: for matched or partial, quote the exact resume line that proves it (short, verbatim); for missing, an empty string.
- missingKeywords: up to 10 skills, tools, or terms from the job description that do not appear in the resume at all.
- fixes: exactly 3 places to close the most important gaps, most impactful first. Prefer gaps the resume undersells: where an existing line already hints at the requirement but does not say it plainly (for example React work when the job accepts "a similar modern framework", or a design system that may have covered accessibility). Each has the gap, where: the exact existing resume line it relates to (verbatim) or the section name, and action: one specific instruction about that line, such as which term from the job description to name explicitly or which result to quantify. State it as a pointer, never as a rewritten line. For a hard gap with no related evidence, say plainly that it is a gap and how to address it honestly (for example in the cover letter).
- technologies: up to 10 technologies or tools named in the job description.

<resume>
${resumeText}
</resume>

<job_description>
${jobDescription}
</job_description>`;
}
