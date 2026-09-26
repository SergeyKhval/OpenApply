import { HttpsError } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import type { MatchToolResult } from "./matchEngine";
import { lockLines, segmentResume, type SourceLine } from "./tailorSegment";
import {
  assembleTailoredResume,
  tailorStats,
  verifyTailorOps,
  type TailoredDoc,
  type TailorOp,
  type TailorStats,
  type VerifiedOp,
} from "./tailorVerify";

// Tailored resume: the model proposes edits to numbered resume lines and
// tailorVerify decides which survive. The model never writes a header, a
// name, an employer or a date; those are always rendered from the source.

export const TAILOR_MODEL = "gemini-3.5-flash";
export const TAILOR_PROMPT_VERSION = "tailor-v1";
const MAX_OPS = 40;

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(TAILOR_MODEL, { temperature: 0 }),
});

export const TailorModelOutputSchema = z.object({
  headerLineIds: z.array(z.string()),
  sectionOrder: z.array(z.string()),
  ops: z.array(
    z.object({
      kind: z.enum(["moveUp", "cut", "rephrase", "surfaceKeyword"]),
      lineIds: z.array(z.string()),
      text: z.string(),
      term: z.string(),
      requirement: z.number().int(),
      reason: z.string(),
    }),
  ),
});

export type TailorModelOutput = z.infer<typeof TailorModelOutputSchema>;

export type TailorUsage = { inputTokens: number; outputTokens: number; thoughtsTokens: number };

export type TailorGenerate = (prompt: string) => Promise<{ output: TailorModelOutput | null; usage: TailorUsage }>;

export type TailorInput = {
  resumeText: string;
  analysis: Pick<MatchToolResult, "companyName" | "position" | "parseCheck" | "requirements" | "missingKeywords" | "fixes" | "technologies">;
};

export type TailorResult = {
  lines: SourceLine[];
  sectionOrder: string[];
  ops: VerifiedOp[];
  doc: TailoredDoc;
  stats: TailorStats;
  usage: TailorUsage;
};

const ROLE_LABEL: Record<SourceLine["role"], string> = {
  heading: "SECTION",
  locked: "FIXED",
  bullet: "EDITABLE",
};

export function buildTailorPrompt(lines: SourceLine[], analysis: TailorInput["analysis"]): string {
  const numbered = lines.map((line) => `${line.id} | ${ROLE_LABEL[line.role]} | ${line.text}`).join("\n");
  const requirements = analysis.requirements
    .map(
      (requirement, index) =>
        `${index}. [${requirement.importance}, ${requirement.status}] ${requirement.requirement}` +
        (requirement.evidence ? ` (evidence: "${requirement.evidence}")` : ""),
    )
    .join("\n");
  const fixes = analysis.fixes.map((fix) => `- ${fix.gap}: ${fix.action} (where: ${fix.where})`).join("\n");

  return `You tailor a resume to one job by editing the candidate's own lines. You are strict about truth: a recruiter will hold the candidate to every word, so you never add anything the resume doesn't already say.

The job: ${analysis.position || "unknown position"} at ${analysis.companyName || "unknown company"}.

The resume, one line per id. SECTION lines are section titles, FIXED lines (name, contact, job and school headers, dates) can never be edited, cut or moved. Only EDITABLE lines can be changed.
<resume>
${numbered}
</resume>

The job's requirements, numbered, with what a screener found in the resume:
<requirements>
${requirements}
</requirements>

Fixes a screener suggested:
<fixes>
${fixes || "- none"}
</fixes>

Terms the job wants that the resume does NOT contain. Never add any of these anywhere; the app lists them to the candidate as honest gaps: ${analysis.missingKeywords.join(", ") || "none"}.

Return:
- headerLineIds: ids of any EDITABLE lines that are really headers (a job title, employer, school, or dates line). Empty if none.
- sectionOrder: the SECTION line ids in the order that best fits this job (for example Skills before Education). Use every SECTION id exactly once.
- ops: at most ${MAX_OPS} edits, most useful first. Each has kind, lineIds, text, term, requirement (the requirement number it serves, or -1 for a cut) and reason (one short sentence). Unused fields are "" or [].
  - moveUp: lineIds [one EDITABLE line]. Moves it to the top of its own job or section. Use it for the lines that prove the job's must-haves.
  - rephrase: lineIds [one EDITABLE line, or two EDITABLE lines from the same job to merge], text: the new line. Use it to name a requirement in the job's own words when the line already states it in other words, to lead with the result, or to tighten. The new text may only use facts the cited lines state.
  - surfaceKeyword: lineIds [the one EDITABLE line that already states it], term: a skill or tool from the job that this line literally names. It gets added to the Skills section.
  - cut: lineIds [one EDITABLE line] that doesn't help for this job. Never cut a whole job, a header, or education. Cut sparingly.

Hard rules for every rephrase:
- Never add a skill, tool, employer, product, title, degree, certification, language, location, date, number, percentage, or amount that the cited lines don't state.
- Never raise ownership, seniority or scope: "helped", "contributed to" or "worked on" never becomes "led", "owned", "managed", "architected" or "spearheaded". "Team member" never becomes "lead". Keep "a", "some", "several" as they are, never "all", "every", "entire".
- Never do arithmetic: 3 years plus 2 years is not "5+ years". Never round, never add "over", "more than" or "+".
- Never move a bullet to a different job and never merge bullets from different jobs.
- If a requirement is missing, leave it missing. Do not hint at it.
- Keep the candidate's voice and tense. Shorter is fine; longer only by a few words.
- If nothing can be improved honestly, return an empty ops list.`;
}

const defaultGenerate: TailorGenerate = async (prompt) => {
  const response = await ai.generate({
    prompt,
    output: { schema: TailorModelOutputSchema, format: "json" },
  });
  return {
    output: response.output,
    usage: {
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
      thoughtsTokens: response.usage?.thoughtsTokens ?? 0,
    },
  };
};

/**
 * Proposes and verifies a tailored version of a resume for one job, using a
 * match analysis already run on the same resume text. Throws
 * failed-precondition when the resume text can't be edited safely.
 */
export async function tailorResume(
  input: TailorInput,
  generate: TailorGenerate = defaultGenerate,
): Promise<TailorResult> {
  const { analysis } = input;
  if (analysis.parseCheck.status === "scrambled") {
    throw new HttpsError(
      "failed-precondition",
      "Your resume's text came out jumbled, so we can't edit it safely. Upload a simpler PDF (single column).",
    );
  }

  const segmented = segmentResume(input.resumeText);
  if (!segmented.some((line) => line.role === "bullet")) {
    throw new HttpsError("failed-precondition", "We couldn't find any resume lines we can safely edit.");
  }

  let generated: Awaited<ReturnType<TailorGenerate>>;
  try {
    generated = await generate(buildTailorPrompt(segmented, analysis));
  } catch (error) {
    console.error("Tailored resume generation failed:", error instanceof Error ? error.message : error);
    throw new HttpsError("internal", "The AI took a wrong turn. Try again in a moment.");
  }
  if (!generated.output) {
    throw new HttpsError("internal", "The AI came back empty. Try again in a moment.");
  }

  const lines = lockLines(segmented, generated.output.headerLineIds);
  const ops: TailorOp[] = generated.output.ops.slice(0, MAX_OPS);
  const verified = verifyTailorOps(ops, {
    lines,
    vocabulary: { terms: [...analysis.technologies, ...analysis.missingKeywords] },
    requirementCount: analysis.requirements.length,
  });
  const sectionOrder = generated.output.sectionOrder;

  return {
    lines,
    sectionOrder,
    ops: verified,
    doc: assembleTailoredResume(lines, verified, sectionOrder),
    stats: tailorStats(verified),
    usage: generated.usage,
  };
}
