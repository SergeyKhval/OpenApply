import { HttpsError } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import type { MatchToolResult } from "./matchEngine";
import { lockLines, segmentResume, type SourceLine } from "./tailorSegment";
import {
  assembleTailoredResume,
  canonicalize,
  containsPhrase,
  skillsSectionText,
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
export const TAILOR_PROMPT_VERSION = "tailor-v2";
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
  analysis: Pick<
    MatchToolResult,
    "companyName" | "position" | "matchScore" | "parseCheck" | "requirements" | "missingKeywords" | "fixes" | "technologies"
  >;
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

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Concrete work for the model, computed in code: which line proves each
 * met or partly met requirement, and which of the job's tools a bullet
 * names but the Skills section doesn't list.
 */
export function buildTailorWorklist(lines: SourceLine[], analysis: TailorInput["analysis"]): string[] {
  const bullets = lines.filter((line) => line.role === "bullet");
  const items: string[] = [];
  analysis.requirements.forEach((requirement, index) => {
    if (requirement.status === "missing" || !requirement.evidence) return;
    const evidence = normalize(requirement.evidence);
    const line = bullets.find((candidate) => {
      const text = normalize(candidate.text);
      return text.includes(evidence) || (text.length > 20 && evidence.includes(text));
    });
    if (!line) return;
    items.push(
      `Requirement ${index} ("${requirement.requirement}", ${requirement.importance}, ${requirement.status}) is proven by ${line.id}. ` +
        "moveUp it if it isn't first in its job, and rephrase it to use the requirement's words where the line already states the same thing in other words.",
    );
  });

  const skills = skillsSectionText(lines);
  const skillsCanonical = skills === null ? null : canonicalize(skills);
  for (const technology of analysis.technologies) {
    if (skillsCanonical !== null && containsPhrase(skillsCanonical, technology)) continue;
    const line = bullets.find((candidate) => containsPhrase(canonicalize(candidate.text), technology));
    if (!line) continue;
    const index = analysis.requirements.findIndex((requirement) => containsPhrase(canonicalize(requirement.requirement), technology));
    items.push(
      `${line.id} names "${technology}" but the Skills section doesn't list it: surfaceKeyword with requirement ${index >= 0 ? index : "the closest one"}.`,
    );
  }
  return items;
}

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
  const worklist = buildTailorWorklist(lines, analysis);
  const target = analysis.matchScore >= 85 ? "0 to 6 edits: the resume is already strong, change only what clearly helps" : "4 to 12 edits";

  return `Tailor this resume to one job by editing the candidate's own lines, so a screener sees the job's must-haves first and in the job's own words. Every edit you propose is checked by code against the source lines, and any edit that adds or strengthens a claim is thrown out, so propose useful edits confidently and let the check do its job.

The job: ${analysis.position || "unknown position"} at ${analysis.companyName || "unknown company"}. Match score today: ${analysis.matchScore}/100.

The resume, one line per id. SECTION lines are section titles. FIXED lines (name, contact, job and school headers, dates) never change. Only EDITABLE lines can be edited.
<resume>
${numbered}
</resume>

The job's requirements, numbered, with what a screener found:
<requirements>
${requirements}
</requirements>

Fixes a screener suggested:
<fixes>
${fixes || "- none"}
</fixes>

Start with this worklist:
<worklist>
${worklist.length ? worklist.map((item) => `- ${item}`).join("\n") : "- nothing specific; look for lines that prove a requirement"}
</worklist>

Return:
- headerLineIds: ids of any EDITABLE lines that are really headers (a job title, employer, school, or dates line). Empty if none.
- sectionOrder: every SECTION id once, in the order that best fits this job (for example Skills before Education).
- ops: ${target}, most useful first. Each has kind, lineIds, text, term, requirement (the requirement number it serves, -1 only for a cut) and reason (one short sentence). Unused fields are "" or [].
  - rephrase: lineIds [one EDITABLE line, or two from the same job to merge], text: the new line. Name the requirement in the job's words when the line already says the same thing differently (for example "churn prediction models" → "predictive models for churn"), lead with the result, or tighten.
  - moveUp: lineIds [one EDITABLE line]. Moves it to the top of its own job or section.
  - surfaceKeyword: lineIds [the EDITABLE line that names it], term: a job tool or skill that line literally names. It is added to Skills.
  - cut: lineIds [one EDITABLE line] that doesn't help for this job. Never a header, a whole job, or education.

What the check throws out (so don't bother proposing it):
- Any skill, tool, employer, title, degree, certification, language, date, number, percentage or amount the cited lines don't state. These are gaps the candidate must address honestly: ${analysis.missingKeywords.join(", ") || "none"}.
- Stronger ownership, seniority or scope: "helped", "supported" or "contributed to" never becomes "led", "owned" or "managed"; "some" never becomes "all".
- Dropped qualifiers: keep words like informally, a handful, some, basic, learning, started, coursework, exposure, familiar, assisted, supported, part of, candidate, no production use, personal project.
- Added intensifiers: busy, high-volume, fast-paced, extensive, significant, major, complex, critical, large-scale, strategic, robust, successful, numerous.
- Arithmetic or rounding ("3 years" and "2 years" are not "5+ years"; never add "over", "more than" or "+").
- Words from the job's requirements that the cited line doesn't already say.
- Bullets moved to another job, merged across jobs, or rewritten more than a few words longer.`;
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
      { code: "scrambled" },
    );
  }

  const segmented = segmentResume(input.resumeText);
  if (!segmented.some((line) => line.role === "bullet")) {
    throw new HttpsError("failed-precondition", "We couldn't find any resume lines we can safely edit.", {
      code: "nothing_to_edit",
    });
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
    vocabulary: {
      terms: [...analysis.technologies, ...analysis.missingKeywords],
      requirementTexts: analysis.requirements.map((requirement) => requirement.requirement),
    },
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
