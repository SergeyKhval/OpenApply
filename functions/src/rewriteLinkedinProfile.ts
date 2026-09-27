import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import {
  describeClientIp,
  getClientIp,
  hashClientKey,
  rateLimitHashKey,
  rateLimitWindows,
} from "./lib/matchTool";
import { assertWithinLimits, validateLinkedinRewriteInput } from "./lib/linkedinRewriteTool";
import { generateLinkedinRewrite } from "./lib/linkedinRewriteEngine";

defineString("GEMINI_API_KEY");

const db = getFirestore();

// Own collection, own budget: this tool's calls never compete with the
// resume match tool's daily allowance.
const RATE_LIMIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

async function consumeRateLimit(clientKey: string) {
  const now = new Date();
  const windows = rateLimitWindows(clientKey, now);
  const refs = {
    hourly: db.collection("linkedinToolUsage").doc(windows.hourly),
    daily: db.collection("linkedinToolUsage").doc(windows.daily),
    global: db.collection("linkedinToolUsage").doc(windows.global),
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
      transaction.set(ref, { count: FieldValue.increment(1), expiresAt }, { merge: true });
    }
  });
}

/**
 * Public, no-signup LinkedIn headline/About rewriter used by the landing
 * page tool. Callers only need an anonymous Firebase session. Nothing from
 * the request is stored.
 */
export const rewriteLinkedinProfile = onCall(
  // LLM calls are I/O bound: one CPU serves many concurrent requests
  { maxInstances: 5, concurrency: 40, cpu: 1, memory: "512MiB", timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Session expired. Reload the page and try again.");
    }

    const input = validateLinkedinRewriteInput(request.data);
    const clientIp = getClientIp(request.rawRequest);
    logger.info("rewriteLinkedinProfile client key", {
      ...describeClientIp(request.rawRequest),
      keyedBy: clientIp ? "ip" : "uid",
    });
    await consumeRateLimit(
      hashClientKey(clientIp ?? `uid:${request.auth.uid}`, rateLimitHashKey()),
    );

    const result = await generateLinkedinRewrite(input);
    return { result };
  },
);
