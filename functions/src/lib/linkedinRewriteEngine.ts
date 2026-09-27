import { HttpsError } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import {
  buildLinkedinRewritePrompt,
  segmentAbout,
  verifyLinkedinRewriteLine,
  type LinkedinRewriteInput,
  type LinkedinRewriteLineVerdict,
} from "./linkedinRewriteTool";

// LinkedIn headline/About rewriter: the model proposes a new headline and a
// rewrite of each About paragraph, and tailorVerify's fact checks (newFacts,
// droppedQualifiers, namesOthersWork, unsupportedJobWords) decide which
// survive. A line that adds or strengthens a claim reverts to the visitor's
// original wording.

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-3.5-flash", { temperature: 0 }),
});

export const LinkedinRewriteModelOutputSchema = z.object({
  why: z.string(),
  headline: z.string(),
  aboutLines: z.array(z.object({ id: z.string(), text: z.string() })),
});

export type LinkedinRewriteModelOutput = z.infer<typeof LinkedinRewriteModelOutputSchema>;

export type LinkedinRewriteGenerate = (
  prompt: string,
) => Promise<{ output: LinkedinRewriteModelOutput | null }>;

export type LinkedinRewriteResult = {
  why: string;
  headline: LinkedinRewriteLineVerdict;
  about: LinkedinRewriteLineVerdict[];
  stats: { proposed: number; changed: number; kept: number };
};

const defaultGenerate: LinkedinRewriteGenerate = async (prompt) => {
  const response = await ai.generate({
    prompt,
    output: { schema: LinkedinRewriteModelOutputSchema, format: "json" },
  });
  return { output: response.output };
};

function computeStats(lines: LinkedinRewriteLineVerdict[]) {
  const changed = lines.filter((line) => line.changed).length;
  return { proposed: lines.length, changed, kept: lines.length - changed };
}

/**
 * Proposes and verifies a rewritten headline and About section. Throws
 * internal HttpsErrors with user-facing messages on generation failure.
 */
export async function generateLinkedinRewrite(
  input: LinkedinRewriteInput,
  generate: LinkedinRewriteGenerate = defaultGenerate,
): Promise<LinkedinRewriteResult> {
  const lines = segmentAbout(input.about);

  let output: LinkedinRewriteModelOutput | null;
  try {
    output = (await generate(buildLinkedinRewritePrompt(input, lines))).output;
  } catch (error) {
    console.error("LinkedIn rewrite generation failed:", error instanceof Error ? error.message : error);
    throw new HttpsError("internal", "The AI took a wrong turn. Try again in a moment.");
  }
  if (!output) {
    throw new HttpsError("internal", "The AI came back empty. Try again in a moment.");
  }

  const wholeSourceText = `${input.headline}\n\n${input.about}`;
  const headline = verifyLinkedinRewriteLine(
    "headline",
    input.headline,
    output.headline,
    wholeSourceText,
    input.targetRole,
  );
  const byId = new Map(output.aboutLines.map((line) => [line.id, line.text]));
  const about = lines.map((line) =>
    verifyLinkedinRewriteLine(line.id, line.text, byId.get(line.id) ?? line.text, wholeSourceText, input.targetRole),
  );

  return {
    why: output.why.replace(/\s+/g, " ").trim().slice(0, 300),
    headline,
    about,
    stats: computeStats([headline, ...about]),
  };
}
