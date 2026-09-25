import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { canonicalJobUrl } from "./lib/jobUrl";

const db = getFirestore();

type JobRequestData = {
  url?: unknown;
};

export const jobs = onCall(async (request) => {
  const { url } =
    typeof request.data === "object" && request.data !== null
      ? (request.data as JobRequestData)
      : { url: undefined };

  if (!url || typeof url !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid URL");
  }

  if (!/^https?:\/\/.+\..+/.test(url)) {
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
