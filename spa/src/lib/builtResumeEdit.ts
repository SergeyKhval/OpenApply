// Editing a built resume: new sections and entries, reordering, and the
// soft checks shown under an entry. Pure, so the editor components stay thin.
import {
  SECTION_HEADINGS,
  cleanField,
  type ResumeBullet,
  type ResumeContact,
  type ResumeEducation,
  type ResumeRole,
  type ResumeSection,
  type SectionType,
  type StructuredResume,
} from "@/lib/builtResume";

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

// In the order the "Add section" menu lists them
export const SECTION_ORDER: SectionType[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
  "volunteering",
  "awards",
];

export const SECTION_LABELS: Record<SectionType, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
  volunteering: "Volunteering",
  awards: "Awards",
};

export const newBullet = (id = newId()): ResumeBullet => ({ id, text: "" });

export const newRole = (id = newId()): ResumeRole => ({
  id,
  title: "",
  organization: "",
  location: "",
  start: null,
  end: null,
  bullets: [newBullet()],
});

export const newEducation = (id = newId()): ResumeEducation => ({
  id,
  degree: "",
  school: "",
  location: "",
  start: null,
  end: null,
  bullets: [],
});

export function newSection(type: SectionType, id = newId()): ResumeSection {
  const heading = SECTION_HEADINGS[type][0] ?? SECTION_LABELS[type];
  switch (type) {
    case "summary":
      return { id, type, heading, text: "" };
    case "experience":
    case "projects":
    case "volunteering":
      return { id, type, heading, entries: [newRole()] };
    case "education":
      return { id, type, heading, entries: [newEducation()] };
    default:
      return { id, type, heading, items: [] };
  }
}

/** Section types the resume doesn't have yet, in menu order. */
export function missingSectionTypes(resume: StructuredResume): SectionType[] {
  const present = new Set(resume.sections.map((section) => section.type));
  return SECTION_ORDER.filter((type) => !present.has(type));
}

/** Moves list[index] by delta in place. Returns the new index, or the old one when it can't move. */
export function moveInPlace<T>(list: T[], index: number, delta: -1 | 1): number {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return index;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item as T);
  return target;
}

export type Removed<T> = { list: T[]; index: number; item: T };

/** Removes list[index] in place and returns what undo needs. */
export function removeAt<T>(list: T[], index: number): Removed<T> | null {
  const [item] = list.splice(index, 1);
  return item === undefined ? null : { list, index, item };
}

export function undoRemove<T>(removed: Removed<T>): void {
  removed.list.splice(Math.min(removed.index, removed.list.length), 0, removed.item);
}

const LONG_BULLET = 220;

/** Hints under an entry. Never blocking. */
export function entryHints(entry: ResumeRole | ResumeEducation, isEducation: boolean): string[] {
  const hints: string[] = [];
  const bullets = entry.bullets.filter((bullet) => cleanField(bullet.text));
  const header = isEducation
    ? cleanField((entry as ResumeEducation).degree) || cleanField((entry as ResumeEducation).school)
    : cleanField((entry as ResumeRole).title) || cleanField((entry as ResumeRole).organization);
  if (!header && !bullets.length) return hints;
  if (!entry.start && !entry.end) hints.push("Add dates, so recruiters and ATS see when this was.");
  if (!isEducation && !bullets.length) hints.push("Add a line or two on what you did here.");
  if (bullets.some((bullet) => cleanField(bullet.text).length > LONG_BULLET)) {
    hints.push("One of these lines runs past two lines on the page. Shorter reads better.");
  }
  return hints;
}

/** Hints under the contact card. Never blocking. */
export function contactHints(contact: ResumeContact): string[] {
  const hints: string[] = [];
  if (!cleanField(contact.name)) hints.push("Add your name, it's the first line recruiters read.");
  if (!cleanField(contact.email)) hints.push("Add an email, so recruiters can reach you.");
  return hints;
}
