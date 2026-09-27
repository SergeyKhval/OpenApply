// Starting a built resume from an uploaded PDF or LinkedIn (functions
// importResume). The import leaves what it couldn't confirm empty and lists it
// in `importedFrom`; these helpers show that to the user until they fix it.
// Nothing here writes `importedFrom`: a marker clears when its field is
// filled in, and an unsorted line when it appears in the resume.
import type { ComputedRef, InjectionKey } from "vue";
import { newId as randomId } from "@/lib/builtResumeEdit";
import type { ResumeEducation, ResumeRole, StructuredResume } from "@/lib/builtResume";

export const MAX_IMPORT_PDF_BYTES = 5 * 1024 * 1024;
export const FLAGGED_HINT = "Check this, we couldn't read it clearly.";

/** The editor provides the import's flagged paths to every FlaggedHint. */
export const FLAGGED_FIELDS: InjectionKey<ComputedRef<ReadonlySet<string>>> = Symbol("flaggedFields");

const isEmpty = (value: unknown) => value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);

/**
 * Whether a field the import flagged is still empty. `path` is a flagged
 * path ("contact.email", "sections.<id>.entries.<id>.start"), or
 * "contact.links" for the links as a group.
 */
export function isFlagged(flagged: ReadonlySet<string>, path: string, value: unknown): boolean {
  if (!isEmpty(value)) return false;
  if (flagged.has(path)) return true;
  return [...flagged].some((flaggedPath) => flaggedPath.startsWith(`${path}.`));
}

const normalize = (text: string) => text.replace(/^[\s•·*–-]+/, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Unsorted lines from the import the user hasn't placed yet. */
export function pendingUnsorted(unsorted: string[] | undefined, structured: StructuredResume): string[] {
  if (!unsorted?.length) return [];
  const placed = new Set<string>();
  for (const section of structured.sections) {
    if ("entries" in section) section.entries.forEach((entry) => entry.bullets.forEach((bullet) => placed.add(normalize(bullet.text))));
    else if ("items" in section) section.items.forEach((item) => placed.add(normalize(item)));
    else placed.add(normalize(section.text));
  }
  return unsorted.filter((line) => !placed.has(normalize(line)));
}

export type EntryTarget = { sectionId: string; entryId: string; label: string };

/** Every job, project and school, as places an unsorted line can go. */
export function entryTargets(structured: StructuredResume): EntryTarget[] {
  return structured.sections.flatMap((section) => {
    if (!("entries" in section)) return [];
    return (section.entries as (ResumeRole | ResumeEducation)[]).map((entry) => {
      const parts = "degree" in entry ? [entry.degree, entry.school] : [entry.title, entry.organization];
      return {
        sectionId: section.id,
        entryId: entry.id,
        label: parts.filter((part) => part.trim()).join(", ") || section.heading,
      };
    });
  });
}

/** Adds an unsorted line to an entry as a bullet. */
export function placeLine(
  structured: StructuredResume,
  line: string,
  target: Pick<EntryTarget, "sectionId" | "entryId">,
  newId: () => string = randomId,
): void {
  const section = structured.sections.find((candidate) => candidate.id === target.sectionId);
  if (!section || !("entries" in section)) return;
  const entry = (section.entries as (ResumeRole | ResumeEducation)[]).find((candidate) => candidate.id === target.entryId);
  entry?.bullets.push({ id: newId(), text: line.replace(/^[\s•·*–-]+/, "").trim() });
}

/** Why a picked file can't be imported, or null when it can. */
export function checkImportFile(file: { name: string; type: string; size: number }): string | null {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return "That file isn't a PDF.";
  if (file.size > MAX_IMPORT_PDF_BYTES) return "That PDF is too big. LinkedIn's own export is well under 5 MB.";
  return null;
}

export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

// importResume writes these for the user; network and timeout errors don't
const USER_FACING = new Set(["invalid-argument", "failed-precondition", "resource-exhausted", "permission-denied", "not-found", "internal"]);
const FALLBACK = "Something went wrong while importing. Try again in a moment.";

export function importErrorMessage(error: unknown): { message: string; code: string } {
  const maybe = (error ?? {}) as { code?: unknown; message?: unknown; details?: { code?: unknown } };
  const status = typeof maybe.code === "string" && maybe.code.startsWith("functions/") ? maybe.code.slice("functions/".length) : "";
  if (!status) return { message: FALLBACK, code: "unknown" };
  const code = typeof maybe.details?.code === "string" ? maybe.details.code : status;
  const message = USER_FACING.has(status) && typeof maybe.message === "string" && maybe.message ? maybe.message : FALLBACK;
  return { message, code };
}
