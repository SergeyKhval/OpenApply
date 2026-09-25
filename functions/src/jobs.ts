import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { canonicalJobUrl } from "./lib/jobUrl";

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

function isWebUrl(value: string): boolean {
  return /^https?:\/\/.+\..+/.test(value);
}

async function createPastedJob(text: unknown, url: unknown) {
  if (typeof text !== "string" || text.trim().length < MIN_PASTED_CHARS) {
    throw new HttpsError("invalid-argument", "That's too short to be a job description. Paste the whole posting.");
  }
  if (text.length > MAX_PASTED_CHARS) {
    throw new HttpsError("invalid-argument", "That's longer than any job description we've seen. Paste just the posting.");
  }
  if (url != null && (typeof url !== "string" || !isWebUrl(url))) {
    throw new HttpsError("invalid-argument", "Invalid URL format");
  }

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

export const jobs = onCall(async (request) => {
  const { url, text } =
    typeof request.data === "object" && request.data !== null
      ? (request.data as JobRequestData)
      : { url: undefined, text: undefined };

  if (text !== undefined) return createPastedJob(text, url);

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
        return { id: existingDoc.id };
      }
    }

    const doc = await db.collection("jobs").add({
      jobDescriptionLink: canonicalUrl,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { id: doc.id };
  } catch (err) {
    console.error("Error in jobs callable:", err);
    throw new HttpsError("internal", "Internal Server Error");
  }
});
