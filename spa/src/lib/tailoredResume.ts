// Tailored resume on the client: rebuilds the document from a stored
// tailoredResumes doc with the user's switched-off edits, and turns the
// verified edits into the change list.
//
// assembleTailoredResume mirrors functions/src/lib/tailorVerify.ts; keep in
// sync. Both are checked against shared/tailoredResumeCases.json.

export type LineRole = "heading" | "locked" | "bullet";

export type SourceLine = {
  id: string;
  text: string;
  bullet: boolean;
  role: LineRole;
  owner: string | null;
  section: string | null;
};

export type TailorOpKind = "moveUp" | "cut" | "rephrase" | "surfaceKeyword";

export type RevertReason =
  | "unknown_line"
  | "locked_line"
  | "conflict"
  | "owner_mismatch"
  | "new_fact"
  | "too_long"
  | "no_requirement"
  | "no_change"
  | "empty_text"
  | "term_not_in_source"
  | "term_already_listed"
  | "qualified_source"
  | "others_work"
  | "dropped_specifier"
  | "dropped_qualifier"
  | "scope_change"
  | "job_word";

export type VerifiedOp = {
  index: number;
  kind: TailorOpKind;
  lineIds: string[];
  text: string;
  term: string;
  requirement: number;
  reason: string;
  status: "applied" | "reverted";
  revertReason?: RevertReason;
  offendingTokens?: string[];
};

export type DocLine = {
  text: string;
  bullet: boolean;
  kind: "original" | "rephrased" | "surfaced";
  sourceIds: string[];
  opIndex?: number;
};

export type DocSection = {
  heading: string | null;
  lines: DocLine[];
};

export type TailoredDoc = { sections: DocSection[] };

const SKILLS_HEADING = /skill|competenc|technolog|tools|stack/i;
const INTRO_HEADING = /summary|profile|about|objective/i;

/**
 * Builds the final resume from the source lines and the applied edits. Every
 * line that no edit touched is the source text, byte for byte. `excluded`
 * holds edit indexes the user switched off.
 */
export function assembleTailoredResume(
  lines: SourceLine[],
  verified: VerifiedOp[],
  sectionOrder: string[],
  excluded: ReadonlySet<number> = new Set(),
): TailoredDoc {
  const active = verified.filter((op) => op.status === "applied" && !excluded.has(op.index));
  const cut = new Set(active.filter((op) => op.kind === "cut").map((op) => op.lineIds[0]));
  const rephrasedBy = new Map<string, VerifiedOp>();
  const consumed = new Set<string>();
  for (const op of active.filter((candidate) => candidate.kind === "rephrase")) {
    rephrasedBy.set(op.lineIds[0]!, op);
    op.lineIds.slice(1).forEach((id) => consumed.add(id));
  }
  const moveRank = new Map<string, number>();
  active.filter((op) => op.kind === "moveUp").forEach((op, rank) => moveRank.set(op.lineIds[0]!, rank));
  const movedBy = new Map(active.filter((op) => op.kind === "moveUp").map((op) => [op.lineIds[0]!, op.index]));

  const toDocLine = (line: SourceLine): DocLine => {
    const rephrase = rephrasedBy.get(line.id);
    if (rephrase) {
      return { text: rephrase.text, bullet: line.bullet, kind: "rephrased", sourceIds: rephrase.lineIds, opIndex: rephrase.index };
    }
    const moveIndex = movedBy.get(line.id);
    return {
      text: line.text,
      bullet: line.bullet,
      kind: "original",
      sourceIds: [line.id],
      ...(moveIndex !== undefined ? { opIndex: moveIndex } : {}),
    };
  };

  // Bullets under one owner, moved ones first (in edit order), then the rest
  // in source order. Owners (job headers) never move.
  const sectionLines = (sectionId: string | null): DocLine[] => {
    const members = lines.filter(
      (line) => line.section === sectionId && line.id !== sectionId && !cut.has(line.id) && !consumed.has(line.id),
    );
    const result: DocLine[] = [];
    let group: SourceLine[] = [];
    const flush = () => {
      const rank = (line: SourceLine) => moveRank.get(line.id) ?? 0;
      const moved = group.filter((line) => moveRank.has(line.id)).sort((a, b) => rank(a) - rank(b));
      const rest = group.filter((line) => !moveRank.has(line.id));
      result.push(...[...moved, ...rest].map(toDocLine));
      group = [];
    };
    for (const line of members) {
      if (line.role === "bullet") {
        if (group.length && group[0]!.owner !== line.owner) flush();
        group.push(line);
      } else {
        flush();
        result.push(toDocLine(line));
      }
    }
    flush();
    return result;
  };

  const headings = lines.filter((line) => line.role === "heading");
  const headingIds = new Set(headings.map((line) => line.id));
  const order =
    sectionOrder.length === headings.length &&
    new Set(sectionOrder).size === sectionOrder.length &&
    sectionOrder.every((id) => headingIds.has(id))
      ? sectionOrder
      : headings.map((line) => line.id);
  const byId = new Map(lines.map((line) => [line.id, line]));

  const sections: DocSection[] = [];
  const top = sectionLines(null);
  if (top.length) sections.push({ heading: null, lines: top });
  for (const id of order) {
    sections.push({ heading: byId.get(id)?.text ?? null, lines: sectionLines(id) });
  }

  const surfaced = active.filter((op) => op.kind === "surfaceKeyword");
  if (surfaced.length) {
    const line: DocLine = {
      text: surfaced.map((op) => op.term).join(", "),
      bullet: false,
      kind: "surfaced",
      sourceIds: surfaced.map((op) => op.lineIds[0]!),
    };
    const skills = sections.find((section) => section.heading && SKILLS_HEADING.test(section.heading));
    if (skills) {
      skills.lines.push(line);
    } else {
      // No Skills section: add one near the top, after the summary if any
      const introIndex = sections.findIndex((section) => section.heading && INTRO_HEADING.test(section.heading));
      const insertAt = introIndex >= 0 ? introIndex + 1 : top.length ? 1 : 0;
      sections.splice(insertAt, 0, { heading: "Skills", lines: [line] });
    }
  }

  return { sections: sections.filter((section) => section.lines.length || section.heading === null) };
}

// --- The change list ---

export type ChangeKind = "reworded" | "moved" | "cut" | "skills";

export type ChangeRow = {
  index: number;
  kind: ChangeKind;
  label: string;
  before: string;
  after: string;
  requirement: string;
  included: boolean;
};

export type KeptRow = {
  index: number;
  kind: ChangeKind;
  before: string;
  explanation: string;
};

const KIND: Record<TailorOpKind, { kind: ChangeKind; label: string }> = {
  rephrase: { kind: "reworded", label: "Reworded" },
  moveUp: { kind: "moved", label: "Moved up" },
  cut: { kind: "cut", label: "Cut" },
  surfaceKeyword: { kind: "skills", label: "Added to Skills" },
};

// Words from the check's tokens that are worth naming back to the user
function namedTokens(tokens: string[] = []): string[] {
  return [
    ...new Set(
      tokens
        .filter((token) => /^(word|term|job|num):/.test(token))
        .map((token) => token.slice(token.indexOf(":") + 1)),
    ),
  ];
}

const quoteList = (words: string[]) => words.map((word) => `“${word}”`).join(", ");

/**
 * Why an edit was kept as the original, in plain words, or null for reverts
 * that aren't worth showing (duplicates, no-ops, edits of lines that never
 * change).
 */
export function explainRevert(op: VerifiedOp): string | null {
  const words = namedTokens(op.offendingTokens);
  switch (op.revertReason) {
    case "new_fact":
      return words.length
        ? `Kept your original. The suggested wording added ${quoteList(words)}, which this line doesn't say.`
        : "Kept your original. The suggested wording made a stronger claim than this line does.";
    case "job_word":
      return words.length
        ? `Kept your original. The suggested wording borrowed ${quoteList(words)} from the job, which this line doesn't say.`
        : "Kept your original. The suggested wording borrowed words from the job that this line doesn't say.";
    case "dropped_qualifier":
      return "Kept your original. The suggested wording dropped a word that limits the claim.";
    case "scope_change":
      return "Kept your original. The suggested wording changed a number or made something plural.";
    case "dropped_specifier":
      return "Kept your original. The suggested wording dropped which one you meant.";
    case "too_long":
      return "Kept your original. The suggested wording was padded.";
    case "term_not_in_source":
    case "qualified_source":
    case "others_work":
      return op.term ? `Didn't add “${op.term}” to Skills. This line doesn't say you use it.` : null;
    default:
      return null;
  }
}

export function toChangeRows(
  ops: VerifiedOp[],
  lines: SourceLine[],
  requirements: string[],
  excluded: ReadonlySet<number>,
): { changes: ChangeRow[]; kept: KeptRow[] } {
  const text = new Map(lines.map((line) => [line.id, line.text]));
  const before = (op: VerifiedOp) => op.lineIds.map((id) => text.get(id) ?? "").join(" ");
  const changes: ChangeRow[] = [];
  const kept: KeptRow[] = [];
  for (const op of ops) {
    const { kind, label } = KIND[op.kind];
    if (op.status === "applied") {
      changes.push({
        index: op.index,
        kind,
        label,
        before: op.kind === "surfaceKeyword" ? `From: ${before(op)}` : before(op),
        after: op.kind === "rephrase" ? op.text : op.kind === "surfaceKeyword" ? op.term : "",
        requirement: requirements[op.requirement] ?? "",
        included: !excluded.has(op.index),
      });
      continue;
    }
    if (op.kind !== "rephrase" && op.kind !== "surfaceKeyword") continue;
    const explanation = explainRevert(op);
    if (explanation) kept.push({ index: op.index, kind, before: before(op), explanation });
  }
  return { changes, kept };
}

/** Plain text of the document, for copying and for tests. */
export function docText(doc: TailoredDoc): string {
  return doc.sections
    .map((section) => [section.heading, ...section.lines.map((line) => (line.bullet ? `• ${line.text}` : line.text))].filter(Boolean).join("\n"))
    .join("\n\n");
}

/**
 * Newest tailored version per job for each resume, with how many versions
 * that job has. Expects versions newest first.
 */
export function newestTailoredPerJob<T extends { resumeId: string; jobApplicationId: string }>(
  versions: T[],
): Map<string, (T & { count: number })[]> {
  const byResume = new Map<string, (T & { count: number })[]>();
  const seen = new Map<string, T & { count: number }>();
  for (const version of versions) {
    const key = `${version.resumeId}/${version.jobApplicationId}`;
    const newest = seen.get(key);
    if (newest) {
      newest.count += 1;
      continue;
    }
    const entry = { ...version, count: 1 };
    seen.set(key, entry);
    byResume.set(version.resumeId, [...(byResume.get(version.resumeId) ?? []), entry]);
  }
  return byResume;
}
