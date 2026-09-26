import { createHash } from "node:crypto";

// Splits parsed resume text (pdf-parse output: flat text, no layout) into
// numbered lines. The tailor model only ever points at these ids, and every
// line it doesn't rewrite is rendered from this text, not from the model.

export type LineRole = "heading" | "locked" | "bullet";

export type SourceLine = {
  id: string;
  text: string;
  // Had a bullet glyph in the source
  bullet: boolean;
  // heading: a section title. locked: never edited (name, contact, job and
  // school headers). bullet: anything the model may reword, move or cut.
  role: LineRole;
  // Id of the heading or locked line this line sits under in source order.
  // A bullet belongs to that job for good: it can't move to another one.
  owner: string | null;
  // Id of the section heading above this line, null in the top block
  section: string | null;
};

const BULLET_GLYPH = /^[•●▪◦‣∙·*\-–—]\s*/;
const PAGE_MARKER = /^--\s*\d+\s+of\s+\d+\s*--$/i;

const SECTION_HEADINGS = new Set([
  "summary", "professional summary", "profile", "professional profile", "about", "about me",
  "objective", "career objective", "experience", "work experience", "professional experience",
  "relevant experience", "employment", "employment history", "work history", "career history",
  "education", "education and training", "skills", "technical skills", "core skills", "key skills",
  "skills and tools", "tools", "technologies", "tech stack", "core competencies", "competencies",
  "projects", "selected projects", "personal projects", "side projects", "certifications",
  "certificates", "licenses", "licenses and certifications", "certifications and licenses",
  "languages", "awards", "honors", "honors and awards", "awards and honors", "publications",
  "volunteering", "volunteer experience", "interests", "references", "courses", "training",
  "achievements", "leadership", "additional information", "clinical experience",
  "teaching experience", "research experience",
]);

const DEGREE = /\b(b\.?\s?s\.?c?|b\.?\s?a|b\.?\s?eng|m\.?\s?s\.?c?|m\.?\s?a|m\.?\s?eng|mba|ph\.?\s?d|j\.?\s?d|m\.?\s?d|bachelor'?s?|master'?s?|doctorate|diploma|associate'?s? degree|university|college|school|institute)\b/i;
const YEAR = /\b(19|20)\d{2}\b/;
const MONTH_YEAR = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}\b/i;
const PRESENT = /\b(present|current|now)\b/i;
const DURATION_HEADER = /\(\s*\d+\+?\s*(years?|yrs?|months?|mos?)\s*\)/i;
const CONTACT = /(@|https?:\/\/|www\.|linkedin\.com|github\.com|\+?\d[\d\s().-]{7,}\d)/i;

export function normalizeLine(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function isSectionHeading(text: string): boolean {
  const key = text.toLowerCase().replace(/[:|]+$/, "").replace(/&/g, "and").trim();
  return key.split(" ").length <= 5 && SECTION_HEADINGS.has(key);
}

/**
 * A line the model may never edit. Only non-bullet lines qualify, so a
 * bullet that mentions a year stays editable (the fact check still guards
 * its numbers).
 */
export function looksLocked(text: string): boolean {
  if (CONTACT.test(text)) return true;
  if (DURATION_HEADER.test(text)) return true;
  if (MONTH_YEAR.test(text)) return true;
  if (YEAR.test(text) && (PRESENT.test(text) || /\d{4}\s*[-–—]|to\s+\d{4}/.test(text) || text.length < 90)) return true;
  if (DEGREE.test(text) && text.length < 120) return true;
  return false;
}

export function segmentResume(resumeText: string): SourceLine[] {
  const raw = resumeText
    .split(/\r?\n/)
    .map((line) => line.normalize("NFKC"))
    .filter((line) => line.trim() && !PAGE_MARKER.test(line.trim()));

  // Merge soft-wrapped lines so one bullet is one id: a line that starts
  // lowercase with no bullet glyph continues the line above.
  const merged: { text: string; bullet: boolean }[] = [];
  for (const line of raw) {
    const trimmed = line.trim();
    const bullet = BULLET_GLYPH.test(trimmed);
    const text = normalizeLine(trimmed.replace(BULLET_GLYPH, ""));
    if (!text) continue;
    const previous = merged[merged.length - 1];
    if (
      previous &&
      !bullet &&
      /^[a-z]/.test(text) &&
      !looksLocked(text) &&
      (previous.bullet || previous.text.length >= 60) &&
      !isSectionHeading(previous.text)
    ) {
      previous.text = `${previous.text} ${text}`;
      continue;
    }
    merged.push({ text, bullet });
  }

  let section: string | null = null;
  const lines = merged.map<SourceLine>(({ text, bullet }, index) => {
    const id = `L${index + 1}`;
    let role: LineRole;
    if (!bullet && isSectionHeading(text)) {
      role = "heading";
      section = id;
    } else if (section === null) {
      // Everything above the first section (name, title, contact) is fixed
      role = "locked";
    } else if (!bullet && looksLocked(text)) {
      role = "locked";
    } else {
      role = "bullet";
    }
    return { id, text, bullet, role, owner: null, section };
  });

  // In a section that marks its bullets with glyphs, a line without one is a
  // job or school header ("Junior Developer, Acme Corp").
  const sectionsWithGlyphs = new Set(lines.filter((line) => line.bullet).map((line) => line.section));
  // A short line right above a dates line is that job's title line.
  const lockedIndex = lines.map((line) => line.role === "locked");
  for (const [index, line] of lines.entries()) {
    if (line.role !== "bullet" || line.bullet) continue;
    const beforeLocked = lockedIndex[index + 1] && line.text.length < 100 && !/[.!?]$/.test(line.text);
    if (sectionsWithGlyphs.has(line.section) || beforeLocked) line.role = "locked";
  }
  return assignOwners(lines);
}

/**
 * Locks extra lines (the ones the model says are headers). Locking only ever
 * makes the check stricter, so the model's word is taken here.
 */
export function lockLines(lines: SourceLine[], ids: Iterable<string>): SourceLine[] {
  const toLock = new Set(ids);
  return assignOwners(
    lines.map((line) =>
      toLock.has(line.id) && line.role === "bullet" ? { ...line, role: "locked" as const } : line,
    ),
  );
}

function assignOwners(lines: SourceLine[]): SourceLine[] {
  let owner: string | null = null;
  return lines.map((line) => {
    const withOwner = { ...line, owner };
    if (line.role !== "bullet") owner = line.id;
    return withOwner;
  });
}

export function hashResumeText(resumeText: string): string {
  return createHash("sha256").update(resumeText).digest("hex");
}
