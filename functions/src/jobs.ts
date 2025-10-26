import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

  try {
    const existingQuery = await db
      .collection("jobs")
      .where("jobDescriptionLink", "==", url)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const existingDoc = existingQuery.docs[0];
      if (existingDoc) {
        return { id: existingDoc.id };
      }
    }

    const doc = await db.collection("jobs").add({
      jobDescriptionLink: url,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { id: doc.id };
  } catch (err) {
    console.error("Error in jobs callable:", err);
    throw new HttpsError("internal", "Internal Server Error");
  }
});
