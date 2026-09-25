import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { recordJobSignals } from "./jobSignals";

const db = getFirestore();

type BackfillRequest = { dryRun?: unknown; limit?: unknown; cursor?: unknown };

// Feeds applications saved before the jobSignals trigger into the signals, a
// page at a time, oldest first. Dry run unless called with { dryRun: false }.
// Pass back nextCursor until it is null.
// Applications carry whole job descriptions: 500 per page ran out of 256MiB
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export const backfillJobSignals = onCall({ timeoutSeconds: 540, memory: "512MiB" }, async (request) => {
  const uid = request.auth?.uid;
  const user = uid ? await db.collection("users").doc(uid).get() : null;
  if (!user || user.get("admin") !== true) {
    throw new HttpsError("permission-denied", "Admins only");
  }

  const data = (typeof request.data === "object" && request.data !== null ? request.data : {}) as BackfillRequest;
  const dryRun = data.dryRun !== false;
  const limit = typeof data.limit === "number" && data.limit > 0 ? Math.min(data.limit, MAX_LIMIT) : DEFAULT_LIMIT;

  let query = db.collection("jobApplications").orderBy("createdAt").limit(limit);
  if (typeof data.cursor === "string" && data.cursor) {
    const cursor = await db.collection("jobApplications").doc(data.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const { docs } = await query.get();

  const eligible = docs.filter((doc) => {
    const application = doc.data();
    return typeof application.jobDescriptionLink === "string" && application.jobDescriptionLink && !application.jobKeyHash;
  });

  let recorded = 0;
  if (!dryRun) {
    for (const doc of eligible) {
      const hash = await recordJobSignals(doc.data());
      if (!hash) continue;
      // The trigger sees an unchanged link with a hash and skips this write
      await doc.ref.update({ jobKeyHash: hash });
      recorded++;
    }
  }

  return {
    dryRun,
    scanned: docs.length,
    eligible: eligible.length,
    recorded,
    nextCursor: docs.length === limit ? docs[docs.length - 1].id : null,
  };
});
