import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import {
  assertWithinLimits,
  buildMatchToolPrompt,
  describeClientIp,
  getClientIp,
  hashClientKey,
  rateLimitWindows,
  sanitizeRequirementEvidence,
  validateMatchToolInput,
} from "./lib/matchTool";

defineString("GEMINI_API_KEY");
// Secret for hashing the rate-limit client key (IP or uid); optional so a
// deploy without it still works, falling back to an unsalted hash.
const RATE_LIMIT_HASH_KEY = defineString("RATE_LIMIT_HASH_KEY", { default: "" });

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-3.5-flash", { temperature: 0 }),
});
const db = getFirestore();

// Counters only need to outlive their window; a Firestore TTL policy on
// expiresAt cleans them up.
const RATE_LIMIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

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

async function consumeRateLimit(clientKey: string) {
  const now = new Date();
  const windows = rateLimitWindows(clientKey, now);
  const refs = {
    hourly: db.collection("toolUsage").doc(windows.hourly),
    daily: db.collection("toolUsage").doc(windows.daily),
    global: db.collection("toolUsage").doc(windows.global),
  };
  const expiresAt = Timestamp.fromMillis(now.getTime() + RATE_LIMIT_TTL_MS);

  await db.runTransaction(async (transaction) => {
    const [hourly, daily, global] = await Promise.all([
      transaction.get(refs.hourly),
      transaction.get(refs.daily),
      transaction.get(refs.global),
    ]);

    assertWithinLimits({
      hourly: hourly.data()?.count ?? 0,
      daily: daily.data()?.count ?? 0,
      global: global.data()?.count ?? 0,
    });

    for (const ref of Object.values(refs)) {
      transaction.set(
        ref,
        { count: FieldValue.increment(1), expiresAt },
        { merge: true },
      );
    }
  });
}

/**
 * Public, no-signup resume vs job description match used by the landing
 * page tool. Callers only need an anonymous Firebase session. Nothing from the
 * request is stored; the landing page hands the result to the app after signup.
 */
export const matchResumeTool = onCall(
  // LLM calls are I/O bound: one CPU serves many concurrent requests
  { maxInstances: 5, concurrency: 40, cpu: 1, memory: "512MiB", timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Session expired. Reload the page and try again.");
    }

    const input = validateMatchToolInput(request.data);
    const clientIp = getClientIp(request.rawRequest);
    // Structured, IP-free check that the rate limit key is the real client.
    // No client IP is expected only in the emulator; in production a fresh
    // anonymous uid per request would get around the per-client limits.
    logger.info("matchResumeTool client key", {
      ...describeClientIp(request.rawRequest),
      keyedBy: clientIp ? "ip" : "uid",
    });
    await consumeRateLimit(
      hashClientKey(clientIp ?? `uid:${request.auth.uid}`, RATE_LIMIT_HASH_KEY.value() || undefined),
    );

    let result: MatchToolResult | null;
    try {
      const response = await ai.generate({
        prompt: buildMatchToolPrompt(input),
        output: { schema: MatchToolResultSchema, format: "json" },
      });
      result = response.output;
    } catch (error) {
      console.error("matchResumeTool generation failed:", error instanceof Error ? error.message : error);
      throw new HttpsError("internal", "The AI took a wrong turn. Try again in a moment.");
    }

    if (!result) {
      throw new HttpsError("internal", "The AI came back empty. Try again in a moment.");
    }

    const matchScore = Math.max(0, Math.min(100, Math.round(result.matchScore)));
    const analysis: MatchToolResult = {
      ...result,
      matchScore,
      requirements: sanitizeRequirementEvidence(
        input.resumeText,
        result.requirements.slice(0, 10),
      ),
      missingKeywords: result.missingKeywords.slice(0, 10),
      fixes: result.fixes.slice(0, 3),
      technologies: result.technologies.slice(0, 10),
    };

    return { analysis };
  },
);
