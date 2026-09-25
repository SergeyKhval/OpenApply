import { HttpsError } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import {
  buildMatchToolPrompt,
  sanitizeRequirementEvidence,
  type MatchToolInput,
} from "./matchTool";

// One resume vs job description engine for the free tool and the in-app
// check, so both keep the same "never invents evidence" guarantee.
const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-3.5-flash", { temperature: 0 }),
});

export const MatchToolResultSchema = z.object({
  companyName: z.string(),
  position: z.string(),
  parseCheck: z.object({
    status: z.enum(["clean", "issues", "scrambled"]),
    note: z.string(),
  }),
  matchScore: z.number().int(),
  verdict: z.string(),
  requirements: z.array(
    z.object({
      requirement: z.string(),
      status: z.enum(["matched", "partial", "missing"]),
      importance: z.enum(["must-have", "nice-to-have"]),
      evidence: z.string(),
    }),
  ),
  missingKeywords: z.array(z.string()),
  fixes: z.array(
    z.object({
      gap: z.string(),
      where: z.string(),
      action: z.string(),
    }),
  ),
  technologies: z.array(z.string()),
});

export type MatchToolResult = z.infer<typeof MatchToolResultSchema>;

/**
 * Runs the match and applies the evidence backstop: any Met or Partly
 * requirement whose evidence is not verbatim in the resume becomes Missing.
 * Throws internal HttpsErrors with user-facing messages.
 */
export async function analyzeResumeMatch(input: MatchToolInput): Promise<MatchToolResult> {
  let result: MatchToolResult | null;
  try {
    const response = await ai.generate({
      prompt: buildMatchToolPrompt(input),
      output: { schema: MatchToolResultSchema, format: "json" },
    });
    result = response.output;
  } catch (error) {
    console.error("Resume match generation failed:", error instanceof Error ? error.message : error);
    throw new HttpsError("internal", "The AI took a wrong turn. Try again in a moment.");
  }

  if (!result) {
    throw new HttpsError("internal", "The AI came back empty. Try again in a moment.");
  }

  return {
    ...result,
    matchScore: Math.max(0, Math.min(100, Math.round(result.matchScore))),
    requirements: sanitizeRequirementEvidence(
      input.resumeText,
      result.requirements.slice(0, 10),
    ),
    missingKeywords: result.missingKeywords.slice(0, 10),
    fixes: result.fixes.slice(0, 3),
    technologies: result.technologies.slice(0, 10),
  };
}

/**
 * Maps an analysis onto the matchResult shape stored in resumeJobMatches,
 * which the app's match card and sheet already read. Requirements go into
 * skills_comparison by status, so a downgraded requirement shows as missing.
 */
export function toStoredMatchResult(analysis: MatchToolResult) {
  const withStatus = (status: "matched" | "partial") =>
    analysis.requirements
      .filter((requirement) => requirement.status === status)
      .map(({ requirement, evidence }) => ({ skill: requirement, status, evidence }));

  return {
    match_summary: {
      overall_match_percent: analysis.matchScore,
      summary: analysis.verdict,
    },
    skills_comparison: {
      matched_skills: withStatus("matched"),
      partially_matched_skills: withStatus("partial"),
      missing_skills: analysis.requirements
        .filter((requirement) => requirement.status === "missing")
        .map(({ requirement }) => ({ skill: requirement, status: "missing" as const })),
    },
    recommendations: {
      improvement_areas: analysis.fixes.map((fix) => `${fix.gap}: ${fix.action}`),
    },
  };
}
