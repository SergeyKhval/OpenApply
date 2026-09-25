import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { canonicalJobUrl } from "./lib/jobUrl";
import {
  describeClientIp,
  getClientIp,
  hashClientKey,
  rateLimitHashKey,
  rateLimitWindows,
} from "./lib/matchTool";
import { assertJobsWithinLimits } from "./lib/jobsRateLimit";

const db = getFirestore();

type JobRequestData = {
  url?: unknown;
  // A pasted job description, for pages the scraper can't read (LinkedIn,
  // Indeed, login walls). Skips the scrape and goes straight to the parser.
  text?: unknown;
};

// Lower than the app's own minimum: the server only rejects obvious junk
export const MIN_PASTED_CHARS = 100;
export const MAX_PASTED_CHARS = 20000;

// Counters only need to outlive their window; a Firestore TTL policy on
// expiresAt cleans them up.
const RATE_LIMIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

function isWebUrl(value: string): boolean {
  return /^https?:\/\/.+\..+/.test(value);
}

// A separate collection from the match tool's counters: sharing one would
// let a client's jobs usage and match-tool usage count against each other,
// and the global counter's doc id doesn't include the client key at all.
async function consumeJobsRateLimit(clientKey: string) {
  const now = new Date();
  const windows = rateLimitWindows(clientKey, now);
  const refs = {
    hourly: db.collection("jobRateLimits").doc(windows.hourly),
    daily: db.collection("jobRateLimits").doc(windows.daily),
    global: db.collection("jobRateLimits").doc(windows.global),
  };
  const expiresAt = Timestamp.fromMillis(now.getTime() + RATE_LIMIT_TTL_MS);

  await db.runTransaction(async (transaction) => {
    const [hourly, daily, global] = await Promise.all([
      transaction.get(refs.hourly),
      transaction.get(refs.daily),
      transaction.get(refs.global),
    ]);

    assertJobsWithinLimits({
      hourly: hourly.data()?.count ?? 0,
      daily: daily.data()?.count ?? 0,
      global: global.data()?.count ?? 0,
    });

    for (const ref of Object.values(refs)) {
      transaction.set(ref, { count: FieldValue.increment(1), expiresAt }, { merge: true });
    }
  });
}

async function createPastedJob(text: unknown, url: unknown, clientKey: string) {
  if (typeof text !== "string" || text.trim().length < MIN_PASTED_CHARS) {
    throw new HttpsError("invalid-argument", "That's too short to be a job description. Paste the whole posting.");
  }
  if (text.length > MAX_PASTED_CHARS) {
    throw new HttpsError("invalid-argument", "That's longer than any job description we've seen. Paste just the posting.");
  }
  if (url != null && (typeof url !== "string" || !isWebUrl(url))) {
    throw new HttpsError("invalid-argument", "Invalid URL format");
  }

  // A paste is never a cache hit (see below), so it always spends quota
  await consumeJobsRateLimit(clientKey);

  try {
    // Pasted jobs are never shared through the link cache: the text is only
    // as good as what one visitor pasted, so the posting's link is kept under
    // postingLink, which the cache lookup doesn't read
    const doc = await db.collection("jobs").add({
      source: "paste",
      status: "scrapped",
      content: text.trim(),
      ...(typeof url === "string" ? { postingLink: canonicalJobUrl(url) ?? url } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: doc.id };
  } catch (err) {
    console.error("Error in jobs callable:", err);
    throw new HttpsError("internal", "Internal Server Error");
  }
}

export const jobs = onCall(
  { maxInstances: 5, concurrency: 40, cpu: 1, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    const { url, text } =
      typeof request.data === "object" && request.data !== null
        ? (request.data as JobRequestData)
        : { url: undefined, text: undefined };

    const clientIp = getClientIp(request.rawRequest);
    // Structured, IP-free check that the rate limit key is the real client.
    // No client IP is expected only in the emulator.
    logger.info("jobs client key", {
      ...describeClientIp(request.rawRequest),
      keyedBy: clientIp ? "ip" : "uid",
    });
    const clientKey = hashClientKey(
      clientIp ?? `uid:${request.auth?.uid ?? "unknown"}`,
      rateLimitHashKey(),
    );

    if (text !== undefined) return createPastedJob(text, url, clientKey);

    if (!url || typeof url !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid URL");
    }

    if (!isWebUrl(url)) {
      throw new HttpsError("invalid-argument", "Invalid URL format");
    }

    const canonicalUrl = canonicalJobUrl(url) ?? url;

    try {
      // Older docs were cached under the link as pasted
      const existingQuery = await db
        .collection("jobs")
        .where("jobDescriptionLink", "in", [...new Set([canonicalUrl, url])])
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingDoc = existingQuery.docs[0];
        if (existingDoc) {
          // A cache hit costs one indexed read, so it never touches the
          // rate limit: it's not a new scrape or a new parse.
          return { id: existingDoc.id };
        }
      }

      await consumeJobsRateLimit(clientKey);

      const doc = await db.collection("jobs").add({
        jobDescriptionLink: canonicalUrl,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });

      return { id: doc.id };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("Error in jobs callable:", err);
      throw new HttpsError("internal", "Internal Server Error");
    }
  },
);
