import { HttpsError } from "firebase-functions/v2/https";

// Length and Tone choices from the cover letter sheet. Both optional: old
// clients send neither and get the template's default letter.
export type CoverLetterLength = "short" | "standard";
export type CoverLetterTone = "plain" | "warm";
export type CoverLetterStyle = { length: CoverLetterLength; tone: CoverLetterTone };

const LENGTHS: CoverLetterLength[] = ["short", "standard"];
const TONES: CoverLetterTone[] = ["plain", "warm"];

export function parseCoverLetterStyle(data: { length?: unknown; tone?: unknown } | undefined): CoverLetterStyle {
  const length = data?.length ?? "standard";
  const tone = data?.tone ?? "plain";
  if (!LENGTHS.includes(length as CoverLetterLength)) {
    throw new HttpsError("invalid-argument", "length must be short or standard");
  }
  if (!TONES.includes(tone as CoverLetterTone)) {
    throw new HttpsError("invalid-argument", "tone must be plain or warm");
  }
  return { length: length as CoverLetterLength, tone: tone as CoverLetterTone };
}

const LENGTH_RULES: Record<CoverLetterLength, string> = {
  short: "Keep it short: at most 150 words in three brief paragraphs.",
  standard: "Aim for 250 to 350 words.",
};

const TONE_RULES: Record<CoverLetterTone, string> = {
  plain: "Write plainly and directly. No flattery, no filler phrases like \"I am thrilled\" or \"passionate\".",
  warm: "Write in a warm, personable voice, still specific and free of cliches.",
};

export const styleInstructions = (style: CoverLetterStyle) =>
  `\n\nLength and tone:\n- ${LENGTH_RULES[style.length]}\n- ${TONE_RULES[style.tone]}`;

// Stored with the letter so a rewrite can default to the same choices
export const promptVersion = (style: CoverLetterStyle) => `cover-letter-v2-${style.length}-${style.tone}`;
