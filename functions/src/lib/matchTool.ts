import { createHash, createHmac } from "node:crypto";
import { BlockList, isIP } from "node:net";
import { HttpsError } from "firebase-functions/v2/https";

export const MIN_INPUT_CHARS = 200;
export const MAX_RESUME_CHARS = 15000;
export const MAX_JOB_DESCRIPTION_CHARS = 15000;

// Anonymous abuse limits for the public match tool
export const HOURLY_LIMIT_PER_CLIENT = 6;
export const DAILY_LIMIT_PER_CLIENT = 15;
export const DAILY_GLOBAL_LIMIT = 200;

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
  const forwarded = forwardedEntries(rawRequest);
  if (forwarded.length > 0) {
    return forwarded[forwarded.length - 1] ?? null;
  }
  return rawRequest.ip || null;
}

function forwardedEntries(rawRequest: {
  headers?: Record<string, string | string[] | undefined>;
}): string[] {
  const header = rawRequest.headers?.["x-forwarded-for"];
  const value = Array.isArray(header) ? header.join(",") : header;
  return value
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean) ?? [];
}

const PRIVATE_RANGES = new BlockList();
PRIVATE_RANGES.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_RANGES.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_RANGES.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_RANGES.addSubnet("100.64.0.0", 10, "ipv4");
PRIVATE_RANGES.addAddress("::1", "ipv6");
PRIVATE_RANGES.addSubnet("fc00::", 7, "ipv6");
PRIVATE_RANGES.addSubnet("fe80::", 10, "ipv6");

// Google front end and load balancer proxy ranges
const GOOGLE_PROXY_RANGES = new BlockList();
GOOGLE_PROXY_RANGES.addSubnet("35.191.0.0", 16, "ipv4");
GOOGLE_PROXY_RANGES.addSubnet("130.211.0.0", 22, "ipv4");

function inRange(ranges: BlockList, ip: string | null): boolean | null {
  if (!ip) return null;
  const family = isIP(ip);
  if (family === 0) return null;
  return ranges.check(ip, family === 4 ? "ipv4" : "ipv6");
}

/**
 * Describes where the rate limit key came from without exposing any IP, so
 * production logs can confirm the chosen entry is the real client and not a
 * Google proxy that every user would share.
 */
export function describeClientIp(rawRequest: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}) {
  const chosen = getClientIp(rawRequest);
  return {
    forwardedCount: forwardedEntries(rawRequest).length,
    hasSocketIp: Boolean(rawRequest.ip),
    chosenEqualsSocketIp: chosen !== null && chosen === rawRequest.ip,
    chosenIsValidIp: chosen !== null && isIP(chosen) !== 0,
    chosenIsPrivate: inRange(PRIVATE_RANGES, chosen),
    chosenIsGoogleProxy: inRange(GOOGLE_PROXY_RANGES, chosen),
  };
}

/**
 * Hashes a client identifier so raw IPs are never stored. Uses HMAC-SHA256
 * keyed with a secret, since a plain hash of an IP is reversible by brute
 * force (the IPv4 space is small enough to enumerate). Falls back to the
 * previous unsalted SHA-256 with a warning when no secret is configured, so
 * a deploy without the param set still works.
 */
export function hashClientKey(value: string, secret?: string): string {
  const input = `openapply-match-tool:${value}`;
  if (!secret) {
    console.warn(
      "hashClientKey: RATE_LIMIT_HASH_KEY is not set; falling back to unsalted SHA-256, which is reversible by brute force. Set the RATE_LIMIT_HASH_KEY param to fix this.",
    );
    return createHash("sha256").update(input).digest("hex").slice(0, 32);
  }
  return createHmac("sha256", secret).update(input).digest("hex").slice(0, 32);
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
- requirements: the 6 to 10 most important requirements from the job description, must-haves first. For each: status "matched", "partial", or "missing"; importance "must-have" or "nice-to-have" based on how the job description phrases it; evidence: for matched or partial, quote the exact resume line that proves it (short, verbatim), but only when that line directly states the requirement in words. Never infer an unstated attribute from context, such as reading a language or nationality from a city, address, or university name (a line like "TU Munich" or "Berlin, Germany" is not evidence of German language skills). If nothing in the resume directly states the requirement, set status to "missing" and evidence to an empty string, even if related context appears nearby.
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

export type MatchToolRequirement = {
  requirement: string;
  status: "matched" | "partial" | "missing";
  importance: "must-have" | "nice-to-have";
  evidence: string;
};

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Defense-in-depth backstop for the tool's "never invents evidence" promise:
 * downgrades any requirement whose evidence is not an actual quote from the
 * resume, regardless of whether the model followed the prompt's instructions.
 * This cannot catch a quote that IS verbatim in the resume but does not
 * itself prove the requirement (that's the prompt-level rule above) — only
 * text the model invented outright.
 */
export function sanitizeRequirementEvidence(
  resumeText: string,
  requirements: MatchToolRequirement[],
): MatchToolRequirement[] {
  const normalizedResume = normalizeForMatch(resumeText);
  return requirements.map((requirement) => {
    if (!requirement.evidence) return requirement;
    const isVerbatim = normalizedResume.includes(normalizeForMatch(requirement.evidence));
    if (isVerbatim) return requirement;
    return { ...requirement, status: "missing" as const, evidence: "" };
  });
}
