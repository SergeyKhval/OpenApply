import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import {
  assertWithinLimits,
  describeClientIp,
  getClientIp,
  hashClientKey,
  rateLimitHashKey,
  rateLimitWindows,
  validateMatchToolInput,
} from "./lib/matchTool";
import { analyzeResumeMatch } from "./lib/matchEngine";

defineString("GEMINI_API_KEY");

const db = getFirestore();

// Counters only need to outlive their window; a Firestore TTL policy on
// expiresAt cleans them up.
const RATE_LIMIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

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
      hashClientKey(clientIp ?? `uid:${request.auth.uid}`, rateLimitHashKey()),
    );

    const analysis = await analyzeResumeMatch(input);
    return { analysis };
  },
);
