import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { segmentResume, type SourceLine } from "./tailorSegment";
import {
  IMPORT_SECTION_TYPES,
  fallbackImport,
  verifyImport,
  type ImportProposal,
  type ImportResult,
} from "./importVerify";

// Resume import for the builder: the model maps numbered source lines to a
// structure and importVerify keeps only what the source says. The model
// never types a bullet: bullets and summaries are line ids, copied by code.

export const IMPORT_MODEL = "gemini-3.5-flash";
export const IMPORT_PROMPT_VERSION = "import-v1";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(IMPORT_MODEL, { temperature: 0 }),
});

// See tailorEngine.ts for why this is untyped. LOW: this is classification
// and copying, not writing, and it roughly halves cost and latency on the
// match engine (oa-4se, oa-6vn).
const IMPORT_THINKING_LEVEL: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH" | undefined = "LOW";

// Built fresh each time: a shared Zod object becomes a JSON-schema $ref,
// which Gemini's response_schema rejects
const cited = () => z.object({ text: z.string(), lineId: z.string() });
const citedDate = () => z.object({ year: z.number().int(), month: z.number().int(), lineId: z.string() });

export const ImportModelOutputSchema = z.object({
  contact: z.object({
    name: cited(),
    headline: cited(),
    email: cited(),
    phone: cited(),
    location: cited(),
    links: z.array(cited()),
  }),
  sections: z.array(
    z.object({
      type: z.enum(IMPORT_SECTION_TYPES),
      headingLineId: z.string(),
      summaryLineIds: z.array(z.string()),
      items: z.array(cited()),
      entries: z.array(
        z.object({
          headerLineIds: z.array(z.string()),
          title: cited(),
          organization: cited(),
          location: cited(),
          start: citedDate(),
          end: citedDate(),
          endIsPresent: z.boolean(),
          bulletLineIds: z.array(z.string()),
        }),
      ),
    }),
  ),
});

export type ImportUsage = { inputTokens: number; outputTokens: number; thoughtsTokens: number };

export type ImportGenerate = (prompt: string) => Promise<{ output: ImportProposal | null; usage: ImportUsage }>;

export type ImportSource = "resume" | "linkedin_pdf" | "linkedin_paste";

const ROLE_LABEL: Record<SourceLine["role"], string> = {
  heading: "SECTION",
  locked: "FIXED",
  bullet: "TEXT",
};

const SOURCE_HINT: Record<ImportSource, string> = {
  resume: "a resume PDF's text",
  linkedin_pdf:
    "a LinkedIn profile exported with Save to PDF. Its sidebar (Contact, Top Skills, Languages, Certifications, Honors-Awards) may come before or between the main parts (name, headline, location, Summary, Experience, Education). Page footers like \"Page 1 of 3\" are noise. Several roles at one employer share one employer line: include that line in each of those roles' headerLineIds.",
  linkedin_paste:
    "text copied from a LinkedIn profile page. Ignore page chrome: buttons and labels (Show all, Connect, Message, Endorse, followers, connections), logo captions, durations like \"3 yrs 2 mos\", endorsement counts and skill summaries like \"Zendesk, Team Leadership and +3 skills\". For organization, cite only the employer's name, without \"· Full-time\" or other employment types.",
};

export function buildImportPrompt(lines: SourceLine[], source: ImportSource): string {
  const numbered = lines.map((line) => `${line.id} | ${ROLE_LABEL[line.role]}${line.bullet ? " •" : ""} | ${line.text}`).join("\n");
  return `Map this resume into sections and entries by pointing at its lines. The input is ${SOURCE_HINT[source]}

Each line has an id, a label (SECTION: a section title; FIXED: a line that looks like a name, contact, job or school header, or dates; TEXT: anything else; • means it had a bullet glyph) and its text.
<lines>
${numbered}
</lines>

Return:
- contact: name, headline (the person's own one-line title, if any), email, phone, location, links (profile or portfolio URLs). Each is {text, lineId}: text copied exactly as written in that line, and the id of that line. {"text": "", "lineId": ""} when absent.
- sections, in source order. Each has:
  - type: one of ${IMPORT_SECTION_TYPES.join(", ")}. Skip sections that fit none (interests, references).
  - headingLineId: the SECTION line that starts it, or "" if it has none.
  - summaryLineIds: for summary only, the ids of its text lines. Otherwise [].
  - items: for skills, languages, certifications and awards only, one {text, lineId} per item, copied exactly (split a comma-separated line into its items). Otherwise [].
  - entries: for experience, projects, volunteering and education only, one per job, project, role or school:
    - headerLineIds: every line of that entry's header (title, employer, location, dates), not its bullets.
    - title (job title, project name or degree), organization (employer or school), location: {text, lineId}, copied exactly from one of the header lines, or empty.
    - start, end: {year, month (1-12, or 0 if the line shows no month), lineId of the header line with the date}, or {"year": 0, "month": 0, "lineId": ""}.
    - endIsPresent: true when the entry is ongoing ("Present", "Current").
    - bulletLineIds: the ids of the lines describing that entry, in order.

Rules:
- Copy text exactly as written. Don't fix typos, expand abbreviations, translate, or reformat anything.
- Never write text that isn't in a line. If you can't find a value, leave it empty.
- A line belongs to one place only. Bullets stay with the entry they appear under in the source.
- Code checks every value against the cited line and drops anything it can't find there, so an empty field is better than a guess.`;
}

const defaultGenerate: ImportGenerate = async (prompt) => {
  const response = await ai.generate({
    prompt,
    output: { schema: ImportModelOutputSchema, format: "json" },
    config: IMPORT_THINKING_LEVEL
      ? ({ thinkingConfig: { thinkingLevel: IMPORT_THINKING_LEVEL } } as Record<string, unknown>)
      : undefined,
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

export type ImportRun = ImportResult & {
  fallback: boolean;
  usage: ImportUsage;
  // What the model proposed, for the gate harness; never stored
  proposal: ImportProposal | null;
};

/**
 * Imports a resume's text into a built resume. Falls back to the plain,
 * model-free structure when the model fails, or when nothing it proposed
 * survives as an entry while the lines alone give some. Not a bullet-count
 * contest: the fallback also counts page noise ("Show all", locations) as
 * bullets. Never throws for a model failure.
 */
export async function importResumeText(
  text: string,
  source: ImportSource,
  generate: ImportGenerate = defaultGenerate,
  newId?: () => string,
): Promise<ImportRun> {
  const lines = segmentResume(text);
  const fallback = fallbackImport(lines, newId);
  const noUsage = { inputTokens: 0, outputTokens: 0, thoughtsTokens: 0 };

  let generated: Awaited<ReturnType<ImportGenerate>>;
  try {
    generated = await generate(buildImportPrompt(lines, source));
  } catch (error) {
    console.error("Resume import generation failed:", error instanceof Error ? error.message : error);
    return { ...fallback, fallback: true, usage: noUsage, proposal: null };
  }
  if (!generated.output) return { ...fallback, fallback: true, usage: generated.usage, proposal: null };

  const verified = verifyImport(lines, generated.output, newId);
  if (verified.stats.entries === 0 && fallback.stats.entries > 0) {
    return { ...fallback, fallback: true, usage: generated.usage, proposal: generated.output };
  }
  return { ...verified, fallback: false, usage: generated.usage, proposal: generated.output };
}
