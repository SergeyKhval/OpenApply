import {
  SECTION_HEADINGS,
  type ItemSectionType,
  type ResumeBullet,
  type ResumeContact,
  type ResumeEducation,
  type ResumeRole,
  type ResumeSection,
  type SectionType,
  type StructuredResume,
  type YearMonth,
} from "./builtResume";
import type { SourceLine } from "./tailorSegment";

// Turns a resume's lines into a built resume without inventing anything.
// The model (importEngine.ts) proposes the structure: which lines are which
// section, entry and bullet, plus short fields (title, employer, dates)
// cited to a line. Code decides what survives:
// - a short field is kept only if it's written in its cited line, and the
//   stored value is the line's own text, never the model's;
// - bullets and summaries are copied from the source by line id, and a
//   bullet only goes under an entry whose header it sits under in the source.
// Anything that fails is left empty and flagged, or listed for the user to
// place by hand. fallbackImport builds a plainer structure with no model.

export const IMPORT_SECTION_TYPES = [
  "summary",
  "experience",
  "projects",
  "volunteering",
  "education",
  "skills",
  "languages",
  "certifications",
  "awards",
] as const satisfies readonly SectionType[];

export type Cited = { text: string; lineId: string };
export type CitedDate = { year: number; month: number; lineId: string };

export type ProposedEntry = {
  headerLineIds: string[];
  title: Cited;
  organization: Cited;
  location: Cited;
  start: CitedDate;
  end: CitedDate;
  endIsPresent: boolean;
  bulletLineIds: string[];
};

export type ProposedSection = {
  type: SectionType;
  headingLineId: string;
  summaryLineIds: string[];
  items: Cited[];
  entries: ProposedEntry[];
};

export type ImportProposal = {
  contact: {
    name: Cited;
    headline: Cited;
    email: Cited;
    phone: Cited;
    location: Cited;
    links: Cited[];
  };
  sections: ProposedSection[];
};

export type ImportStats = {
  sections: number;
  entries: number;
  fieldsVerified: number;
  fieldsFlagged: number;
  bulletsImported: number;
  bulletsUnsorted: number;
  linesSkipped: number;
};

export type ImportResult = {
  structured: StructuredResume;
  // Paths of fields the source proposed but we couldn't confirm, left empty:
  // "contact.email", "sections.<id>.entries.<id>.start"
  flaggedFields: string[];
  // Bullets we couldn't place under a job for sure, for the user to place
  unsorted: string[];
  // Source lines nothing used, shown so nothing silently disappears
  notImported: string[];
  stats: ImportStats;
};

const MONTH_NAMES = [
  ["january", "jan"], ["february", "feb"], ["march", "mar"], ["april", "apr"], ["may"], ["june", "jun"],
  ["july", "jul"], ["august", "aug"], ["september", "sept", "sep"], ["october", "oct"], ["november", "nov"],
  ["december", "dec"],
];
const PRESENT = /\b(present|current|currently|now|today|ongoing)\b/i;
// Punctuation a field may carry at its edges in the source but not in the field
const EDGE_PUNCTUATION = /^[\s,;:|•·*–—-]+|[\s,;:|•·*–—-]+$/g;

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

const isWordChar = (char: string | undefined) => !!char && /[\p{L}\p{N}]/u.test(char);

/**
 * The part of `lineText` that says `candidate`, ignoring case, spacing and
 * edge punctuation, and only on word boundaries ("Go" is not in "Google").
 * Returns the line's own spelling, or null when the line doesn't say it.
 */
export function findVerbatim(lineText: string, candidate: string): string | null {
  const line = normalizeText(lineText);
  const needle = normalizeText(candidate).replace(EDGE_PUNCTUATION, "");
  if (!needle) return null;
  const lowerLine = line.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  // Case folding that changes length would shift indexes: match exactly then
  const caseless = lowerLine.length === line.length && lowerNeedle.length === needle.length;
  const haystack = caseless ? lowerLine : line;
  const target = caseless ? lowerNeedle : needle;
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(target, from);
    if (index < 0) return null;
    const end = index + target.length;
    const boundaryBefore = !isWordChar(line[index - 1]) || !isWordChar(line[index]);
    const boundaryAfter = !isWordChar(line[end]) || !isWordChar(line[end - 1]);
    if (boundaryBefore && boundaryAfter) return line.slice(index, end);
    from = index + 1;
  }
  return null;
}

function hasMonth(lineText: string, month: number, year: number): boolean {
  const lower = normalizeText(lineText).toLowerCase();
  const names = MONTH_NAMES[month - 1] ?? [];
  if (names.some((name) => new RegExp(`\\b${name}\\b\\.?`).test(lower))) return true;
  return new RegExp(`\\b0?${month}\\s*[/.-]\\s*${year}\\b`).test(lower);
}

type Ids = () => string;

/** Verifies the model's proposal against the source lines. */
export function verifyImport(lines: SourceLine[], proposal: ImportProposal, newId: Ids = randomId): ImportResult {
  const byId = new Map(lines.map((line) => [line.id, line]));
  // Lines taken whole (bullets, summaries, headings)
  const used = new Set<string>();
  // Pieces taken from a line as fields: the line only counts as imported
  // when they cover most of it
  const taken = new Map<string, string[]>();
  const take = (lineId: string, piece: string) => taken.set(lineId, [...(taken.get(lineId) ?? []), piece]);
  const flaggedFields: string[] = [];
  const unsorted: string[] = [];
  let fieldsVerified = 0;

  // A short field: kept when its cited line says it, flagged when proposed
  // but not found, silently empty when not proposed
  const field = (cited: Cited | undefined, path: string, allowedLineIds?: ReadonlySet<string>): string => {
    const proposed = cited?.text?.trim() ?? "";
    if (!cited || !proposed) return "";
    const line = byId.get(cited.lineId);
    const found = line && (!allowedLineIds || allowedLineIds.has(line.id)) ? findVerbatim(line.text, proposed) : null;
    if (!line || !found) {
      flaggedFields.push(path);
      return "";
    }
    take(line.id, found);
    fieldsVerified++;
    return found;
  };

  const date = (cited: CitedDate | undefined, path: string, allowedLineIds: ReadonlySet<string>): YearMonth | null => {
    if (!cited?.year) return null;
    const line = byId.get(cited.lineId);
    if (!line || !allowedLineIds.has(line.id) || cited.year < 1950 || cited.year > 2100 || !new RegExp(`\\b${cited.year}\\b`).test(line.text)) {
      flaggedFields.push(path);
      return null;
    }
    fieldsVerified++;
    take(line.id, String(cited.year));
    // A month the line doesn't show is dropped: the year alone is still true
    const month = cited.month >= 1 && cited.month <= 12 && hasMonth(line.text, cited.month, cited.year) ? cited.month : null;
    if (month) (MONTH_NAMES[month - 1] ?? []).forEach((name) => take(line.id, name));
    return { year: cited.year, month };
  };

  // Contact
  const contact: ResumeContact = {
    name: field(proposal.contact.name, "contact.name"),
    headline: field(proposal.contact.headline, "contact.headline"),
    email: field(proposal.contact.email, "contact.email"),
    phone: field(proposal.contact.phone, "contact.phone"),
    location: field(proposal.contact.location, "contact.location"),
    links: proposal.contact.links.map((link, index) => field(link, `contact.links.${index}`)).filter(Boolean),
  };
  if (contact.email && !contact.email.includes("@")) {
    contact.email = "";
    flaggedFields.push("contact.email");
    fieldsVerified--;
  }

  // Header lines: never a heading, never a line with a bullet glyph. They're
  // what owns the bullets under them. A line can head several entries (one
  // employer line over several roles, as LinkedIn does); fields may cite it,
  // but it can't own a bullet, since the source doesn't say which role.
  const headerOwners = new Map<string, Set<number>>();
  const allEntries = proposal.sections.flatMap((section) => section.entries);
  allEntries.forEach((entry, entryIndex) => {
    for (const id of entry.headerLineIds) {
      const line = byId.get(id);
      if (!line || line.role === "heading" || line.bullet) continue;
      headerOwners.set(id, (headerOwners.get(id) ?? new Set()).add(entryIndex));
    }
  });
  const isHeader = (id: string) => headerOwners.has(id);

  // Owner of each line in source order: the nearest line above it that is a
  // heading, a fixed line, or a header of an entry
  const owners = new Map<string, string | null>();
  let currentOwner: string | null = null;
  for (const line of lines) {
    owners.set(line.id, currentOwner);
    if (line.role !== "bullet" || isHeader(line.id)) currentOwner = line.id;
  }

  const bulletsFrom = (ids: string[], entryIndex: number, headers: ReadonlySet<string>): ResumeBullet[] => {
    const bullets: ResumeBullet[] = [];
    for (const id of ids) {
      const line = byId.get(id);
      if (!line || line.role !== "bullet" || isHeader(id) || used.has(id)) continue;
      const owner = owners.get(id);
      if (!owner || !headers.has(owner) || headerOwners.get(owner)?.size !== 1) {
        unsorted.push(line.text);
        used.add(id);
        continue;
      }
      used.add(id);
      bullets.push({ id: newId(), text: line.text });
    }
    return bullets;
  };

  const sections: ResumeSection[] = [];
  let entryIndex = -1;
  for (const proposed of proposal.sections) {
    if (!IMPORT_SECTION_TYPES.includes(proposed.type)) {
      entryIndex += proposed.entries.length;
      continue;
    }
    const sectionId = newId();
    const headingLine = byId.get(proposed.headingLineId);
    if (headingLine?.role === "heading") used.add(headingLine.id);
    const heading = matchHeading(proposed.type, headingLine?.role === "heading" ? headingLine.text : "");
    const path = `sections.${sectionId}`;

    if (proposed.type === "summary") {
      const parts = proposed.summaryLineIds
        .map((id) => byId.get(id))
        .filter((line): line is SourceLine => !!line && line.role === "bullet" && !used.has(line.id) && !isHeader(line.id));
      parts.forEach((line) => used.add(line.id));
      entryIndex += proposed.entries.length;
      if (parts.length) sections.push({ id: sectionId, type: "summary", heading, text: parts.map((line) => line.text).join(" ") });
      continue;
    }

    if (isItemType(proposed.type)) {
      const items = proposed.items.map((item, index) => field(item, `${path}.items.${index}`)).filter(Boolean);
      entryIndex += proposed.entries.length;
      if (items.length) sections.push({ id: sectionId, type: proposed.type, heading, items: [...new Set(items)] });
      continue;
    }

    const entries: (ResumeRole | ResumeEducation)[] = [];
    for (const entry of proposed.entries) {
      entryIndex++;
      const id = newId();
      const entryPath = `${path}.entries.${id}`;
      const headers = new Set(entry.headerLineIds.filter((headerId) => headerOwners.get(headerId)?.has(entryIndex)));
      const title = field(entry.title, `${entryPath}.title`, headers);
      const organization = field(entry.organization, `${entryPath}.organization`, headers);
      const location = field(entry.location, `${entryPath}.location`, headers);
      const start = date(entry.start, `${entryPath}.start`, headers);
      const bullets = bulletsFrom(entry.bulletLineIds, entryIndex, headers);

      let end: YearMonth | "present" | null = null;
      if (entry.endIsPresent) {
        const presentMatch = [...headers]
          .map((headerId) => byId.get(headerId))
          .map((line) => (line ? { line, word: line.text.match(PRESENT)?.[0] } : null))
          .find((candidate) => candidate?.word);
        if (presentMatch?.word && proposed.type !== "education") {
          end = "present";
          take(presentMatch.line.id, presentMatch.word);
          fieldsVerified++;
        } else {
          flaggedFields.push(`${entryPath}.end`);
        }
      } else {
        end = date(entry.end, `${entryPath}.end`, headers);
      }

      if (!title && !organization && !location && !start && !end && !bullets.length) continue;
      if (proposed.type === "education") {
        entries.push({ id, degree: title, school: organization, location, start, end: end === "present" ? null : end, bullets });
      } else {
        entries.push({ id, title, organization, location, start, end, bullets });
      }
    }
    if (!entries.length) continue;
    sections.push(
      proposed.type === "education"
        ? { id: sectionId, type: "education", heading, entries: entries as ResumeEducation[] }
        : { id: sectionId, type: proposed.type, heading, entries: entries as ResumeRole[] },
    );
  }

  for (const line of lines) {
    if (!used.has(line.id) && isMostlyTaken(line.text, taken.get(line.id) ?? [])) used.add(line.id);
  }
  return finish({ version: 1, contact, sections }, lines, used, flaggedFields, unsorted, fieldsVerified);
}

const letters = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "").length;

/**
 * Whether the fields taken from a line cover most of it. A header that gave
 * a title, employer and dates is imported; a wall of text that only gave a
 * job title is not, and gets listed so the rest doesn't vanish.
 */
export function isMostlyTaken(text: string, pieces: string[]): boolean {
  if (!pieces.length) return false;
  let rest = normalizeText(text).toLowerCase();
  for (const piece of [...pieces].sort((a, b) => b.length - a.length)) {
    rest = rest.replace(piece.toLowerCase(), " ");
  }
  return letters(rest) <= letters(text) / 2;
}

function finish(
  structured: StructuredResume,
  lines: SourceLine[],
  used: ReadonlySet<string>,
  flaggedFields: string[],
  unsorted: string[],
  fieldsVerified: number,
): ImportResult {
  const notImported = lines.filter((line) => !used.has(line.id)).map((line) => line.text);
  const entrySections = structured.sections.filter((section): section is Extract<ResumeSection, { entries: unknown }> => "entries" in section);
  return {
    structured,
    flaggedFields,
    unsorted,
    notImported,
    stats: {
      sections: structured.sections.length,
      entries: entrySections.reduce((sum, section) => sum + section.entries.length, 0),
      fieldsVerified,
      fieldsFlagged: flaggedFields.length,
      bulletsImported: entrySections.reduce(
        (sum, section) => sum + section.entries.reduce((count, entry) => count + entry.bullets.length, 0),
        0,
      ),
      bulletsUnsorted: unsorted.length,
      linesSkipped: notImported.length,
    },
  };
}

const ITEM_TYPES: ReadonlySet<SectionType> = new Set<ItemSectionType>(["skills", "languages", "certifications", "awards"]);
const isItemType = (type: SectionType): type is ItemSectionType => ITEM_TYPES.has(type);

/** The source heading when it's one the section allows, else the default. */
export function matchHeading(type: SectionType, sourceHeading: string): string {
  const options = SECTION_HEADINGS[type];
  const key = sourceHeading.replace(/[:|]+$/, "").replace(/&/g, "and").trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === key) ?? options[0] ?? sourceHeading;
}

// --- Without the model ---

const HEADING_TYPES: [RegExp, SectionType][] = [
  [/volunteer/, "volunteering"],
  [/project/, "projects"],
  [/summary|profile|about|objective/, "summary"],
  [/experience|employment|work history|career history/, "experience"],
  [/education|training|courses/, "education"],
  [/skill|competenc|tools|technolog|tech stack/, "skills"],
  [/language/, "languages"],
  [/certif|licen/, "certifications"],
  [/award|honou?r|achievement/, "awards"],
];

export function headingType(text: string): SectionType | null {
  const key = text.toLowerCase();
  return HEADING_TYPES.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

const EMAIL = /[^\s|,;:<>()]+@[^\s|,;:<>()]+\.[a-z]{2,}/i;
const PHONE = /\+?\d[\d\s().-]{7,}\d/;
const LINK = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\/[^\s|,;]+|\bhttps?:\/\/[^\s|,;]+/gi;

/**
 * A plainer built resume from the lines alone, used when the model fails or
 * finds nothing. Every value is a whole source line or a pattern match in
 * one, and entry headers aren't split into title, employer and dates, so
 * each is flagged for the user to check.
 */
export function fallbackImport(lines: SourceLine[], newId: Ids = randomId): ImportResult {
  const used = new Set<string>();
  const flaggedFields: string[] = [];
  const unsorted: string[] = [];
  let fieldsVerified = 0;

  const contact: ResumeContact = { name: "", headline: "", email: "", phone: "", location: "", links: [] };
  for (const line of lines.filter((candidate) => candidate.section === null)) {
    const email = line.text.match(EMAIL)?.[0];
    const phone = line.text.match(PHONE)?.[0];
    const links = line.text.match(LINK) ?? [];
    if (email || phone || links.length) {
      if (email && !contact.email) contact.email = email;
      if (phone && !contact.phone) contact.phone = phone.trim();
      contact.links.push(...links.filter((link) => !contact.links.includes(link)));
      used.add(line.id);
      continue;
    }
    if (!contact.name) {
      contact.name = line.text;
      used.add(line.id);
    } else if (line.text === contact.name) {
      // Pasted profiles repeat the name
      used.add(line.id);
    } else if (!contact.headline) {
      contact.headline = line.text;
      used.add(line.id);
    }
  }
  fieldsVerified += [contact.name, contact.headline, contact.email, contact.phone].filter(Boolean).length + contact.links.length;

  const sections: ResumeSection[] = [];
  const headings = lines.filter((line) => line.role === "heading");
  for (const headingLine of headings) {
    const type = headingType(headingLine.text);
    if (!type) continue;
    used.add(headingLine.id);
    const members = lines.filter((line) => line.section === headingLine.id && line.id !== headingLine.id);
    const id = newId();
    const heading = matchHeading(type, headingLine.text);

    if (type === "summary") {
      const text = members.filter((line) => line.role === "bullet");
      text.forEach((line) => used.add(line.id));
      if (text.length) sections.push({ id, type, heading, text: text.map((line) => line.text).join(" ") });
      continue;
    }

    if (isItemType(type)) {
      const items: string[] = [];
      for (const line of members) {
        const parts = line.bullet || !/[,;]/.test(line.text) ? [line.text] : line.text.split(/[,;]/);
        items.push(...parts.map((part) => part.replace(EDGE_PUNCTUATION, "").trim()).filter(Boolean));
        used.add(line.id);
      }
      if (items.length) sections.push({ id, type, heading, items: [...new Set(items)] });
      continue;
    }

    const entries: (ResumeRole | ResumeEducation)[] = [];
    let current: { entry: ResumeRole | ResumeEducation; headerLines: number } | null = null;
    for (const line of members) {
      if (line.role !== "bullet") {
        // A second header line right after the first (title, then employer
        // and dates) belongs to the same entry
        if (current && !current.entry.bullets.length && current.headerLines === 1) {
          const entryPath = `sections.${id}.entries.${current.entry.id}`;
          if (type === "education") (current.entry as ResumeEducation).school = line.text;
          else (current.entry as ResumeRole).organization = line.text;
          flaggedFields.push(`${entryPath}.${type === "education" ? "school" : "organization"}`);
          current.headerLines++;
          used.add(line.id);
          fieldsVerified++;
          continue;
        }
        const entryId = newId();
        const entry: ResumeRole | ResumeEducation =
          type === "education"
            ? { id: entryId, degree: line.text, school: "", location: "", start: null, end: null, bullets: [] }
            : { id: entryId, title: line.text, organization: "", location: "", start: null, end: null, bullets: [] };
        flaggedFields.push(`sections.${id}.entries.${entryId}.${type === "education" ? "degree" : "title"}`);
        entries.push(entry);
        current = { entry, headerLines: 1 };
        used.add(line.id);
        fieldsVerified++;
        continue;
      }
      used.add(line.id);
      if (current) current.entry.bullets.push({ id: newId(), text: line.text });
      else unsorted.push(line.text);
    }
    if (!entries.length) continue;
    sections.push(
      type === "education"
        ? { id, type: "education", heading, entries: entries as ResumeEducation[] }
        : { id, type, heading, entries: entries as ResumeRole[] },
    );
  }

  return finish({ version: 1, contact, sections }, lines, used, flaggedFields, unsorted, fieldsVerified);
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
