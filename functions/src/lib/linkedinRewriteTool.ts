import { HttpsError } from "firebase-functions/v2/https";
import {
  MAX_REPHRASE_GROWTH,
  droppedQualifiers,
  factTokens,
  namesOthersWork,
  newFacts,
  unsupportedJobWords,
} from "./tailorVerify";

export const MIN_HEADLINE_CHARS = 10;
// LinkedIn's own headline field limit
export const MAX_HEADLINE_CHARS = 220;
export const MIN_ABOUT_CHARS = 40;
// LinkedIn's own About field limit
export const MAX_ABOUT_CHARS = 2600;
export const MAX_TARGET_ROLE_CHARS = 100;

// Anonymous abuse limits for the public LinkedIn rewrite tool, matching the
// resume match tool's tiers (see matchTool.ts): the prompt here is smaller,
// so this is if anything cheaper per call, not more expensive.
export const HOURLY_LIMIT_PER_CLIENT = 6;
export const DAILY_LIMIT_PER_CLIENT = 15;
export const DAILY_GLOBAL_LIMIT = 200;

export type LinkedinRewriteInput = {
  headline: string;
  about: string;
  targetRole: string;
};

/**
 * Validates and normalizes the public LinkedIn rewrite tool payload.
 * Throws invalid-argument with a user-facing message on bad input.
 */
export function validateLinkedinRewriteInput(data: unknown): LinkedinRewriteInput {
  const { headline, about, targetRole } =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

  if (typeof headline !== "string" || typeof about !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Paste your headline and your About section.",
    );
  }
  if (targetRole !== undefined && typeof targetRole !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Paste your headline and your About section.",
    );
  }

  const trimmedHeadline = headline.trim();
  const trimmedAbout = about.trim();
  const trimmedTargetRole = (targetRole ?? "").trim();

  if (trimmedHeadline.length < MIN_HEADLINE_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      "Your headline looks too short. Paste the whole thing.",
    );
  }
  if (trimmedAbout.length < MIN_ABOUT_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      "Your About section looks too short. Paste the whole thing.",
    );
  }
  if (trimmedHeadline.length > MAX_HEADLINE_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      `Your headline is over ${MAX_HEADLINE_CHARS} characters, more than LinkedIn allows. Trim it and try again.`,
    );
  }
  if (trimmedAbout.length > MAX_ABOUT_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      `Your About section is over ${MAX_ABOUT_CHARS.toLocaleString("en-US")} characters, more than LinkedIn allows. Trim it and try again.`,
    );
  }
  if (trimmedTargetRole.length > MAX_TARGET_ROLE_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      `Your target role is over ${MAX_TARGET_ROLE_CHARS} characters. Shorten it and try again.`,
    );
  }

  return { headline: trimmedHeadline, about: trimmedAbout, targetRole: trimmedTargetRole };
}

export type AboutLine = { id: string; text: string };

/**
 * Splits the About text into numbered paragraphs the model rewrites one at a
 * time, so each one can be fact-checked against its own source line rather
 * than the whole section at once. Splits on blank lines first (LinkedIn About
 * text usually has them); falls back to single line breaks when it doesn't.
 */
export function segmentAbout(about: string): AboutLine[] {
  const byBlankLine = about
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const paragraphs =
    byBlankLine.length > 1
      ? byBlankLine
      : about
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);
  return paragraphs.map((text, index) => ({ id: `about-${index + 1}`, text }));
}

export function buildLinkedinRewritePrompt(
  { headline, targetRole }: LinkedinRewriteInput,
  lines: AboutLine[],
): string {
  const numbered = lines.map((line) => `${line.id} | ${line.text}`).join("\n");
  return `Rewrite this person's LinkedIn headline and About section so it reads sharper and more confident, using only what they already wrote. Every line you propose is checked by code against the source line it rewrites, and any line that adds or strengthens a claim is thrown out and the original is kept instead, so propose confidently and let the check do its job.

${targetRole ? `The person is targeting this role or type of role: ${targetRole}. Reorder and emphasize their existing experience toward it. Do not claim the title itself, a skill, a tool, or a level of seniority they didn't already state, even if the target role implies it.` : "No target role given: just tighten and sharpen what's already there."}

Hard rule: never invent anything. Do not add employers, tools, skills, numbers, years, credentials, or a stronger ownership word (helped -> led, supported -> managed) than the source states. Do not drop a hedge the source uses (a side project, started learning, a handful of, informally) since that would make a weak claim read strong. Do not claim a team's or someone else's work as the person's own.

Current headline:
<headline>
${headline}
</headline>

Current About section, one paragraph per id:
<about>
${numbered}
</about>

Return:
- why: one short sentence on the overall angle you took and why (for example "Led with your cloud migration work since that's closest to the target role").
- headline: your rewritten headline, one line, under 220 characters. The same text back if it's already strong.
- aboutLines: one entry per id above, in the same order, each with id and text: your rewritten version of that paragraph, or the same text back if it's already strong. Never merge paragraphs, split one into several, or add a new one.

What the check throws out (so don't bother proposing it):
- Any skill, tool, employer, title, credential, number, percentage, or amount the paragraph you're rewriting doesn't itself state.
- Stronger ownership, seniority, or scope: "helped", "supported" or "contributed to" never becomes "led", "owned" or "managed"; "some" never becomes "all".
- Dropped qualifiers: keep words like informally, a handful, some, basic, learning, started, coursework, exposure, familiar, assisted, supported, part of, candidate, no production use, personal or side project.
- Added intensifiers: busy, high-volume, fast-paced, extensive, significant, major, complex, critical, large-scale, strategic, robust, successful, numerous.
- A skill or tool a paragraph names only as someone else's (a team's, a colleague's) work, claimed as the person's own.`;
}

export type LinkedinRewriteRevertReason =
  | "empty_text"
  | "no_change"
  | "too_long"
  | "new_fact"
  | "dropped_qualifier"
  | "others_work"
  | "job_word";

export type LinkedinRewriteLineVerdict = {
  id: string;
  original: string;
  text: string;
  changed: boolean;
  revertReason?: LinkedinRewriteRevertReason;
  offendingTokens?: string[];
};

const MIN_LENGTH_ALLOWANCE = 24;
const NO_VOCABULARY = { terms: [] as string[] };

const cleanText = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * Individual words and the whole phrase from a target role, fed to newFacts
 * as vocabulary so a role-specific skill the visitor never typed (e.g.
 * "kubernetes", "people management") can't slip into a rewrite just because
 * it isn't capitalized: newFacts's own word/lexicon checks only ever look at
 * capitalization and a fixed seniority/intensifier list, not at role text.
 */
function vocabularyTermsFromTargetRole(targetRole: string): string[] {
  if (!targetRole) return [];
  const words = targetRole
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
  return [...new Set([targetRole, ...words])];
}

/** Named or tool-like words the rewrite and the source both already state. */
function sharedNamedTerms(text: string, sourceText: string): string[] {
  const sourceFacts = factTokens(sourceText, NO_VOCABULARY);
  const shared: string[] = [];
  for (const fact of factTokens(text, NO_VOCABULARY)) {
    if (fact.startsWith("word:") && sourceFacts.has(fact)) shared.push(fact.slice(5));
  }
  return shared;
}

/**
 * Checks one proposed line (the headline, or one About paragraph) with the
 * tailored-resume fact checker: newFacts catches invented skills, numbers,
 * ownership words and intensifiers; droppedQualifiers catches a hedge the
 * rewrite quietly drops; namesOthersWork catches a team's or colleague's
 * work claimed as the person's own. Any hit reverts the line to the
 * original wording, byte for byte.
 *
 * newFacts checks against `wholeSourceText` (the visitor's full headline +
 * About, pasted together), not just this line's own original: a headline
 * honestly summarizing a skill named in the About section is a
 * repositioning, not an invention. droppedQualifiers stays scoped to this
 * line's own original text: whether a hedge survives only makes sense for
 * the line that stated it.
 *
 * namesOthersWork only runs on About lines, not the headline: it flags a
 * shared term followed by a role or group noun (team, engineer, manager...)
 * within a few words, which is exactly the shape of a LinkedIn headline
 * itself ("Frontend Engineer", "Data Scientist" is the candidate's own
 * title, not someone else's), so applying it there would misfire on nearly
 * every headline.
 *
 * When a target role is given, its words feed newFacts as vocabulary (so an
 * exact role term, lowercase or not, has to already be in the pasted text)
 * and unsupportedJobWords additionally catches a role word the rewrite uses
 * that the pasted text has no matching-stem word for, the same check
 * tailor-v2 uses to stop a resume rewrite from stitching the job posting's
 * own wording onto a line.
 */
export function verifyLinkedinRewriteLine(
  id: string,
  original: string,
  proposed: string,
  wholeSourceText: string,
  targetRole = "",
): LinkedinRewriteLineVerdict {
  const revert = (revertReason: LinkedinRewriteRevertReason, offendingTokens?: string[]): LinkedinRewriteLineVerdict => ({
    id,
    original,
    text: original,
    changed: false,
    revertReason,
    ...(offendingTokens ? { offendingTokens } : {}),
  });

  const text = cleanText(proposed);
  if (!text) return revert("empty_text");
  if (text.toLowerCase() === original.trim().toLowerCase()) return revert("no_change");

  const allowed = Math.max(original.length * MAX_REPHRASE_GROWTH, original.length + MIN_LENGTH_ALLOWANCE);
  if (text.length > allowed) return revert("too_long");

  const vocabulary = { terms: vocabularyTermsFromTargetRole(targetRole) };
  const invented = newFacts(text, wholeSourceText, vocabulary);
  if (invented.length) return revert("new_fact", invented);

  const dropped = droppedQualifiers(text, original);
  if (dropped.length) return revert("dropped_qualifier", dropped);

  if (targetRole) {
    const jobWords = unsupportedJobWords(text, wholeSourceText, [targetRole]);
    if (jobWords.length) return revert("job_word", jobWords);
  }

  if (id !== "headline") {
    const others = sharedNamedTerms(text, wholeSourceText).filter((term) => namesOthersWork(wholeSourceText, term));
    if (others.length) return revert("others_work", others);
  }

  return { id, original, text, changed: true };
}

/**
 * Throws resource-exhausted if any counter is already at its limit.
 */
export function assertWithinLimits(counts: { hourly: number; daily: number; global: number }): void {
  if (counts.global >= DAILY_GLOBAL_LIMIT) {
    throw new HttpsError(
      "resource-exhausted",
      "The free tool hit its daily limit. Try again tomorrow, or sign up to run rewrites in the app.",
    );
  }
  if (counts.hourly >= HOURLY_LIMIT_PER_CLIENT) {
    throw new HttpsError(
      "resource-exhausted",
      "You've run a lot of rewrites this hour. Take a breather and try again later.",
    );
  }
  if (counts.daily >= DAILY_LIMIT_PER_CLIENT) {
    throw new HttpsError(
      "resource-exhausted",
      "You've hit today's free limit. Come back tomorrow, or sign up to keep going in the app.",
    );
  }
}

// getClientIp, describeClientIp, hashClientKey, rateLimitHashKey and
// rateLimitWindows are generic (no resume-specific logic) and reused directly
// from matchTool.ts by the callable rather than duplicated here.
