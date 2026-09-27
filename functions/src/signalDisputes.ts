import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();
const MAX_NOTE_CHARS = 2000;

export type DisputeAction = "keep" | "hide" | "resolve";

async function assertAdmin(request: CallableRequest) {
  const uid = request.auth?.uid;
  const user = uid ? await db.collection("users").doc(uid).get() : null;
  if (!uid || !user || user.get("admin") !== true) throw new HttpsError("permission-denied", "Admins only");
  return uid;
}

function iso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

// Admin > Posting reviews: open review requests, oldest first, each with the
// posting it's about and what that posting shows publicly
export const listSignalDisputes = onCall(async (request) => {
  await assertAdmin(request);
  const { docs } = await db.collection("signalDisputes").where("status", "==", "open").get();
  const disputes = await Promise.all(
    docs.map(async (doc) => {
      const data = doc.data();
      const keyHash = String(data.keyHash ?? "");
      const [signals, inputs] = await Promise.all([
        db.collection("jobSignals").doc(keyHash).get(),
        db.collection("jobSignalsPrivate").doc(keyHash).get(),
      ]);
      return {
        id: doc.id,
        keyHash,
        contactEmail: String(data.contactEmail ?? ""),
        message: String(data.message ?? ""),
        createdAt: iso(data.createdAt),
        link: typeof inputs.get("link") === "string" ? inputs.get("link") : null,
        companyTitle: typeof inputs.get("companyTitleKey") === "string" ? inputs.get("companyTitleKey") : null,
        signals: signals.exists
          ? {
            signs: signals.get("signs") ?? null,
            reports: signals.get("reports") ?? null,
            reportsHidden: signals.get("reportsHidden") === true,
            hidden: signals.get("hidden") === true,
          }
          : null,
      };
    }),
  );
  disputes.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  return { disputes };
});

/**
 * keep: the reports stay public again (unless another request on the posting is still open).
 * hide: nothing shows for the posting any more (the admin kill switch).
 * resolve: closes the request with a note and changes nothing on the posting.
 */
export const resolveSignalDispute = onCall(async (request) => {
  const uid = await assertAdmin(request);
  const { disputeId, action, note } = (request.data ?? {}) as { disputeId?: unknown; action?: unknown; note?: unknown };
  if (typeof disputeId !== "string" || !disputeId) throw new HttpsError("invalid-argument", "Missing request");
  if (action !== "keep" && action !== "hide" && action !== "resolve") throw new HttpsError("invalid-argument", "Unknown action");
  const text = typeof note === "string" ? note.trim() : "";
  if (text.length > MAX_NOTE_CHARS) throw new HttpsError("invalid-argument", `Keep the note under ${MAX_NOTE_CHARS} characters`);
  if (action === "resolve" && !text) throw new HttpsError("invalid-argument", "Add a note saying what you decided");

  const disputeRef = db.collection("signalDisputes").doc(disputeId);
  const dispute = await disputeRef.get();
  if (!dispute.exists) throw new HttpsError("not-found", "No such request");
  if (dispute.get("status") !== "open") throw new HttpsError("failed-precondition", "Already resolved");
  const keyHash = String(dispute.get("keyHash") ?? "");
  const signalsRef = db.collection("jobSignals").doc(keyHash);

  await disputeRef.update({
    status: "resolved",
    resolution: action,
    note: text,
    resolvedAt: FieldValue.serverTimestamp(),
    resolvedBy: uid,
  });

  if (action === "hide" && (await signalsRef.get()).exists) {
    await signalsRef.update({ hidden: true });
  }
  if (action === "keep" && (await signalsRef.get()).exists) {
    const stillOpen = await db.collection("signalDisputes").where("keyHash", "==", keyHash).where("status", "==", "open").get();
    if (stillOpen.empty) await signalsRef.update({ reportsHidden: false });
  }
  return { resolved: true };
});
