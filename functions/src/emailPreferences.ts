import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { parseEmailPrefs } from "./lib/emailPrefs";

const db = getFirestore();

// Settings > Email. The profile doc is written by functions only (see
// firestore.rules), so the switch goes through this callable.
export const setEmailPreferences = onCall(async (request) => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("unauthenticated", "Sign in to change email settings.");
  }

  let prefs;
  try {
    prefs = parseEmailPrefs(request.data);
  } catch (error) {
    throw new HttpsError("invalid-argument", (error as Error).message);
  }

  await db
    .collection("users")
    .doc(request.auth.uid)
    .set({ emailPrefs: prefs, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  return prefs;
});
