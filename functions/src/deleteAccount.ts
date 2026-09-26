import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { refreshPublicReports } from "./jobReports";

// Every collection whose documents belong to one user through a `userId`
// field. `jobs` is left alone: it is a shared cache of parsed job pages.
export const USER_DATA_COLLECTIONS = [
  "jobApplications",
  "jobApplicationNotes",
  "contacts",
  "interviews",
  "userResumes",
  "coverLetters",
  "resumeJobMatches",
  "tailoredResumes",
] as const;

// Stripe subscription states that still bill (or may bill) the customer
const BILLING_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);
const PAGE_SIZE = 400;

async function deleteOwnedDocuments(collection: string, uid: string) {
  const db = getFirestore();
  const query = db.collection(collection).where("userId", "==", uid).limit(PAGE_SIZE);
  let deleted = 0;
  for (;;) {
    const snapshot = await query.get();
    if (snapshot.empty) return deleted;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
}

// Settings > Account > Delete account. Removes the user's data, their files
// and finally the sign-in itself, so a run that fails halfway can be retried.
export const deleteAccount = onCall({ timeoutSeconds: 300 }, async (request) => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("unauthenticated", "Sign in to delete your account.");
  }
  if ((request.data as { confirm?: unknown } | null)?.confirm !== "DELETE") {
    throw new HttpsError("invalid-argument", "Type DELETE to confirm.");
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);

  const billing = await userRef.collection("billingProfile").doc("profile").get();
  const status = billing.exists ? billing.data()?.subscriptionStatus : undefined;
  if (typeof status === "string" && BILLING_STATUSES.has(status)) {
    throw new HttpsError(
      "failed-precondition",
      "Cancel your Pro plan first, then delete your account.",
    );
  }

  const counts: Record<string, number> = {};
  for (const collection of USER_DATA_COLLECTIONS) {
    counts[collection] = await deleteOwnedDocuments(collection, uid);
  }
  // Their posting reports go too, and the public counts they fed are redone
  const reported = (await db.collection("jobReports").where("userId", "==", uid).get()).docs;
  counts.jobReports = await deleteOwnedDocuments("jobReports", uid);
  for (const keyHash of new Set(reported.map((doc) => String(doc.get("keyHash"))))) {
    await refreshPublicReports(keyHash);
  }
  await db.recursiveDelete(userRef);
  await getStorage().bucket().deleteFiles({ prefix: `resumes/${uid}/` });
  await getAuth().deleteUser(uid);

  logger.info("Account deleted", { uid, counts });
  return { deleted: true };
});
