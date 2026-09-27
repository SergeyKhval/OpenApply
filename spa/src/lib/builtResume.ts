// Resumes built in the app. The editor stores `structured`; `text` is
// derived from it here and is what every AI feature reads (match, cover
// letter, tailored version), the same field a parsed PDF fills.
//
// The text is written in the shape functions/src/lib/tailorSegment.ts reads:
// contact block above the first heading, known section headings, entry
// headers on their own line, bullets with a glyph. serializeResumeLines
// mirrors functions/src/lib/builtResume.ts; keep in sync. Both are checked
// against shared/builtResumeCases.json.
import type { DocLine, ResumeDoc } from "@/lib/tailoredResume";

export type YearMonth = { year: number; month: number | null };

export type ResumeBullet = { id: string; text: string };

export type ResumeRole = {
  id: string;
  title: string;
  organization: string;
  location: string;
  start: YearMonth | null;
  end: YearMonth | "present" | null;
  bullets: ResumeBullet[];
};

export type ResumeEducation = {
  id: string;
  degree: string;
  school: string;
  location: string;
  start: YearMonth | null;
  end: YearMonth | null;
  bullets: ResumeBullet[];
};

export type RoleSectionType = "experience" | "projects" | "volunteering";
export type ItemSectionType = "skills" | "languages" | "certifications" | "awards";
export type SectionType = "summary" | RoleSectionType | "education" | ItemSectionType;

export type ResumeSection =
  | { id: string; type: "summary"; heading: string; text: string }
  | { id: string; type: RoleSectionType; heading: string; entries: ResumeRole[] }
  | { id: string; type: "education"; heading: string; entries: ResumeEducation[] }
  | { id: string; type: ItemSectionType; heading: string; items: string[] };

export type ResumeContact = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
};

export type StructuredResume = {
  version: 1;
  contact: ResumeContact;
  sections: ResumeSection[];
};

// Headings a section may use, default first. Every one is a heading
// tailorSegment recognizes, so tailoring sees the section boundaries.
export const SECTION_HEADINGS: Record<SectionType, readonly string[]> = {
  summary: ["Summary", "Professional Summary", "Profile", "About"],
  experience: ["Experience", "Work Experience", "Professional Experience", "Relevant Experience", "Employment History"],
  projects: ["Projects", "Selected Projects", "Personal Projects", "Side Projects"],
  volunteering: ["Volunteer Experience", "Volunteering"],
  education: ["Education", "Education and Training"],
  skills: ["Skills", "Technical Skills", "Core Skills", "Key Skills", "Core Competencies", "Tools", "Technologies"],
  languages: ["Languages"],
  certifications: ["Certifications", "Licenses and Certifications", "Certificates"],
  awards: ["Awards", "Honors and Awards"],
};

// Items sections written as one comma-separated line; the others get a
// bullet per item
const INLINE_ITEMS: ReadonlySet<SectionType> = new Set(["skills", "languages"]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const BULLET_GLYPH = "•";

/** One line: newlines and runs of spaces collapse, so a field never splits. */
export function cleanField(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function sectionHeading(section: Pick<ResumeSection, "type" | "heading">): string {
  const options = SECTION_HEADINGS[section.type];
  return options.includes(section.heading) ? section.heading : (options[0] ?? section.heading);
}

function formatYearMonth(value: YearMonth): string {
  const month = value.month && value.month >= 1 && value.month <= 12 ? `${MONTHS[value.month - 1]} ` : "";
  return `${month}${value.year}`;
}

export function formatDateRange(start: YearMonth | null, end: YearMonth | "present" | null): string {
  const from = start ? formatYearMonth(start) : "";
  const to = end === "present" ? "Present" : end ? formatYearMonth(end) : "";
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export function roleHeader(role: ResumeRole): string {
  const what = [cleanField(role.title), cleanField(role.organization)].filter(Boolean).join(", ");
  return [what, cleanField(role.location), formatDateRange(role.start, role.end)].filter(Boolean).join(" | ");
}

export function educationHeader(education: ResumeEducation): string {
  const what = [cleanField(education.degree), cleanField(education.school)].filter(Boolean).join(", ");
  return [what, cleanField(education.location), formatDateRange(education.start, education.end)].filter(Boolean).join(" | ");
}

export function contactLine(contact: ResumeContact): string {
  return [contact.email, contact.phone, contact.location, ...contact.links].map(cleanField).filter(Boolean).join(" | ");
}

export type SerializedLineKind = "name" | "headline" | "contact" | "heading" | "entryHeader" | "bullet" | "text";

export type SerializedLine = {
  kind: SerializedLineKind;
  text: string;
  // Index of the entry header (or heading) line a bullet sits under
  owner: number | null;
};

/**
 * The resume as lines, each tagged with what it is. Empty fields, bullets,
 * entries and sections are left out.
 */
export function serializeResumeLines(resume: StructuredResume): SerializedLine[] {
  const lines: SerializedLine[] = [];
  const push = (kind: SerializedLineKind, text: string, owner: number | null = null) => {
    lines.push({ kind, text, owner });
    return lines.length - 1;
  };

  const name = cleanField(resume.contact.name);
  const headline = cleanField(resume.contact.headline);
  const contact = contactLine(resume.contact);
  if (name) push("name", name);
  if (headline) push("headline", headline);
  if (contact) push("contact", contact);

  for (const section of resume.sections) {
    const body: [SerializedLineKind, string, "entry" | "heading" | null][] = [];
    if (section.type === "summary") {
      const text = cleanField(section.text);
      if (text) body.push(["text", text, null]);
    } else if ("entries" in section) {
      for (const entry of section.entries) {
        const header = section.type === "education" ? educationHeader(entry as ResumeEducation) : roleHeader(entry as ResumeRole);
        const bullets = entry.bullets.map((bullet) => cleanField(bullet.text)).filter(Boolean);
        if (!header && !bullets.length) continue;
        if (header) body.push(["entryHeader", header, null]);
        for (const bullet of bullets) body.push(["bullet", bullet, header ? "entry" : "heading"]);
      }
    } else {
      const items = section.items.map(cleanField).filter(Boolean);
      if (INLINE_ITEMS.has(section.type)) {
        if (items.length) body.push(["text", items.join(", "), null]);
      } else {
        for (const item of items) body.push(["bullet", item, "heading"]);
      }
    }
    if (!body.length) continue;

    const headingIndex = push("heading", sectionHeading(section));
    let entryIndex: number | null = null;
    for (const [kind, text, ownerKind] of body) {
      const owner = ownerKind === "entry" ? entryIndex : ownerKind === "heading" ? headingIndex : null;
      const index = push(kind, text, owner);
      if (kind === "entryHeader") entryIndex = index;
    }
  }
  return lines;
}

/** The plain text stored in userResumes.text. */
export function serializeResume(resume: StructuredResume): string {
  return serializeResumeLines(resume)
    .map((line) => (line.kind === "bullet" ? `${BULLET_GLYPH} ${line.text}` : line.text))
    .join("\n");
}

/**
 * The document the preview and the downloads render, in the same shape as a
 * tailored version, so both go through one exporter.
 */
export function structuredToDoc(resume: StructuredResume): ResumeDoc {
  const toDocLine = (line: SerializedLine): DocLine => ({
    text: line.text,
    bullet: line.kind === "bullet",
    kind: "original",
    sourceIds: [],
    ...(line.kind === "entryHeader" ? { strong: true } : {}),
  });

  const sections: ResumeDoc["sections"] = [{ heading: null, lines: [] }];
  for (const line of serializeResumeLines(resume)) {
    if (line.kind === "heading") {
      sections.push({ heading: line.text, lines: [] });
    } else {
      sections[sections.length - 1]!.lines.push(toDocLine(line));
    }
  }
  return { sections: sections[0]!.lines.length ? sections : sections.slice(1) };
}

// "Complete" for analytics (resume_builder_completed): a name, a way to
// reach you, at least one job or school, and a little content under it.
export function isResumeComplete(resume: StructuredResume): boolean {
  if (!cleanField(resume.contact.name) || !contactLine(resume.contact)) return false;
  let entries = 0;
  let content = 0;
  for (const section of resume.sections) {
    if (section.type === "summary") continue;
    if ("entries" in section) {
      const kept = section.entries.filter((entry) =>
        section.type === "education"
          ? educationHeader(entry as ResumeEducation)
          : roleHeader(entry as ResumeRole),
      );
      if (section.type === "experience" || section.type === "education") entries += kept.length;
      content += section.entries.reduce((sum, entry) => sum + entry.bullets.filter((bullet) => cleanField(bullet.text)).length, 0);
    } else {
      content += section.items.filter((item) => cleanField(item)).length;
    }
  }
  return entries >= 1 && content >= 3;
}

/** A new resume: contact prefilled from the profile, the usual sections empty. */
export function emptyStructuredResume(contact: Partial<ResumeContact> = {}, newId: () => string = randomId): StructuredResume {
  return {
    version: 1,
    contact: { name: "", headline: "", email: "", phone: "", location: "", links: [], ...contact },
    sections: [
      { id: newId(), type: "experience", heading: "Experience", entries: [] },
      { id: newId(), type: "education", heading: "Education", entries: [] },
      { id: newId(), type: "skills", heading: "Skills", items: [] },
    ],
  };
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
