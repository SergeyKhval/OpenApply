import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { defineString } from "firebase-functions/params";
import { Resend } from "resend";
import {
  BLOCK_MESSAGES,
  day,
  isReportReason,
  limitBlock,
  publicReports,
  reportBlock,
  type JobReport,
  type ReportBlock,
} from "./lib/jobReports";
import { normalize } from "./lib/jobSignals";
import { getClientIp, hashClientKey, rateLimitHashKey, rateLimitWindows } from "./lib/matchTool";

const db = getFirestore();
const RESEND_API_KEY = defineString("RESEND_API_KEY");
const FROM_EMAIL = "OpenApply <sergey@openapply.app>";
const DAY_MS = 86400000;
const MAX_DISPUTE_CHARS = 1000;
const DISPUTES_PER_IP_DAY = 3;
const RATE_LIMIT_TTL_MS = 2 * DAY_MS;

function millis(value: unknown): number | undefined {
  return value instanceof Timestamp ? value.toMillis() : undefined;
}

function blocked(block: ReportBlock): never {
  throw new HttpsError("failed-precondition", BLOCK_MESSAGES[block], { block });
}

/** Rewrites a job's public report counts from its reports. */
export async function refreshPublicReports(keyHash: string, now = Date.now()): Promise<void> {
  const reports = (await db.collection("jobReports").where("keyHash", "==", keyHash).get()).docs.map(
    (doc) => doc.data() as JobReport,
  );
  const ref = db.collection("jobSignals").doc(keyHash);
  if (!(await ref.get()).exists) return;
  // Only the reports field: signs belong to the jobSignals trigger
  await ref.update({ reports: publicReports(reports, now) });
}

// Job page > Report. Signed in, the job saved in the tracker, one report per
// person per job (a second call changes the reason).
export const reportJob = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) blocked("not_signed_in");
  const { applicationId, reason } = (request.data ?? {}) as { applicationId?: unknown; reason?: unknown };
  if (typeof applicationId !== "string" || !applicationId || !isReportReason(reason)) {
    throw new HttpsError("invalid-argument", "Pick a reason");
  }

  const now = Date.now();
  const user = await getAuth().getUser(uid);
  const snapshot = await db.collection("jobApplications").doc(applicationId).get();
  const data = snapshot.data();
  const application = data
    ? {
      userId: String(data.userId ?? ""),
      status: String(data.status ?? ""),
      jobKeyHash: typeof data.jobKeyHash === "string" ? data.jobKeyHash : undefined,
      appliedAt: millis(data.appliedAt),
      createdAt: millis(data.createdAt) ?? now,
    }
    : null;
  const block = reportBlock(
    uid,
    {
      emailVerified: user.emailVerified,
      anonymous: request.auth?.token.firebase?.sign_in_provider === "anonymous",
      createdAt: Date.parse(user.metadata.creationTime),
    },
    application,
    reason,
    now,
  );
  if (block) blocked(block);

  const keyHash = application?.jobKeyHash;
  if (!keyHash) blocked("not_saved");
  const company = normalize(String(data?.companyName ?? ""));
  const ref = db.collection("jobReports").doc(`${keyHash}_${uid}`);
  const existing = await ref.get();
  if (existing.get("status") === "removed") throw new HttpsError("permission-denied", "This report was removed after a review.");

  if (!existing.exists || existing.get("status") !== "active") {
    const recent = (
      await db.collection("jobReports")
        .where("userId", "==", uid)
        .where("createdAt", ">=", now - 30 * DAY_MS)
        .orderBy("createdAt", "desc")
        .get()
    ).docs.map((doc) => doc.data() as JobReport);
    const limit = limitBlock(recent, company, now);
    if (limit) blocked(limit);
  }

  const report: JobReport = {
    userId: uid,
    keyHash,
    applicationId,
    reason,
    status: "active",
    company,
    reportedOn: day(now),
    createdAt: existing.get("status") === "active" ? existing.get("createdAt") : now,
  };
  await ref.set(report);
  await refreshPublicReports(keyHash, now);
  return { reason, reportedOn: report.reportedOn };
});

// The reporter takes their report back, any time
export const withdrawJobReport = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) blocked("not_signed_in");
  const { keyHash } = (request.data ?? {}) as { keyHash?: unknown };
  if (typeof keyHash !== "string" || !keyHash) throw new HttpsError("invalid-argument", "Missing job");

  const ref = db.collection("jobReports").doc(`${keyHash}_${uid}`);
  const existing = await ref.get();
  if (existing.get("status") !== "active") return { withdrawn: false };
  await ref.update({ status: "withdrawn" });
  await refreshPublicReports(keyHash);
  return { withdrawn: true };
});

async function consumeDisputeLimit(clientKey: string) {
  const now = new Date();
  const ref = db.collection("disputeRateLimits").doc(rateLimitWindows(clientKey, now).daily);
  await db.runTransaction(async (transaction) => {
    const count = (await transaction.get(ref)).get("count") ?? 0;
    if (count >= DISPUTES_PER_IP_DAY) {
      throw new HttpsError("resource-exhausted", "We already have your requests from today. We'll reply by email.");
    }
    transaction.set(
      ref,
      { count: FieldValue.increment(1), expiresAt: Timestamp.fromMillis(now.getTime() + RATE_LIMIT_TTL_MS) },
      { merge: true },
    );
  });
}

// "Is this your posting? Ask for a review": no account needed. Hides the
// community reports on the job while the review is open (the dated signs stay,
// they come from the posting itself) and emails the admin.
export const submitSignalDispute = onCall(async (request) => {
  const { keyHash, email, message } = (request.data ?? {}) as { keyHash?: unknown; email?: unknown; message?: unknown };
  if (typeof keyHash !== "string" || !/^[0-9a-f]{64}$/.test(keyHash)) {
    throw new HttpsError("invalid-argument", "This link doesn't point to a posting.");
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 200) {
    throw new HttpsError("invalid-argument", "Enter an email we can reply to.");
  }
  if (typeof message !== "string" || !message.trim() || message.length > MAX_DISPUTE_CHARS) {
    throw new HttpsError("invalid-argument", `Tell us what's wrong in up to ${MAX_DISPUTE_CHARS} characters.`);
  }

  const identity = getClientIp(request.rawRequest) ?? `uid:${request.auth?.uid ?? "unknown"}`;
  await consumeDisputeLimit(hashClientKey(identity, rateLimitHashKey()));

  const signalsRef = db.collection("jobSignals").doc(keyHash);
  if (!(await signalsRef.get()).exists) throw new HttpsError("not-found", "We have no signals for this posting.");

  const dispute = await db.collection("signalDisputes").add({
    keyHash,
    contactEmail: email.trim(),
    message: message.trim(),
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });
  await signalsRef.update({ reportsHidden: true });

  const to = process.env.SIGNAL_DISPUTE_EMAIL || "sergey@openapply.app";
  if (RESEND_API_KEY.value()) {
    try {
      await new Resend(RESEND_API_KEY.value()).emails.send({
        from: FROM_EMAIL,
        to,
        replyTo: email.trim(),
        subject: "Posting review request",
        text: [
          `Dispute ${dispute.id} on jobSignals/${keyHash}. Community reports on it are hidden until resolved.`,
          "",
          message.trim(),
          "",
          "Resolve within 7 days: reply to the sender with the decision and the reasons, then set signalDisputes status to resolved and reportsHidden back to false (or hidden: true on the signals doc).",
        ].join("\n"),
      });
    } catch (error) {
      logger.error("Dispute email failed", { dispute: dispute.id, error });
    }
  }
  return { received: true };
});
