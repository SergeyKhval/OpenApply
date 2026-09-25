import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { jobKey, jobKeyHash, jobKeyPrefix } from "./lib/jobKey";
import { canonicalJobUrl } from "./lib/jobUrl";
import {
  observeJob,
  publicSigns,
  sanitizePosting,
  type PrivateJobSignals,
} from "./lib/jobSignals";

const db = getFirestore();

type ApplicationData = Record<string, unknown> | undefined;

function samePosting(a: unknown, b: unknown): boolean {
  return JSON.stringify(sanitizePosting(a) ?? null) === JSON.stringify(sanitizePosting(b) ?? null);
}

/** Whether this write to an application changes what we know about its job. */
export function shouldRecordJobSignals(before: ApplicationData, after: ApplicationData): boolean {
  if (!after || typeof after.jobDescriptionLink !== "string" || !after.jobDescriptionLink) return false;
  if (!before || !after.jobKeyHash) return true;
  return (
    before.jobDescriptionLink !== after.jobDescriptionLink ||
    before.jobId !== after.jobId ||
    !samePosting(before.posting, after.posting)
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Folds one saved application into its job's signals. Returns the job key
 * hash, or null when the link isn't a web page.
 */
export async function recordJobSignals(application: Record<string, unknown>): Promise<string | null> {
  const key = jobKey(text(application.jobDescriptionLink));
  if (!key) return null;
  const hash = jobKeyHash(key);

  // Pasted links: the scraper stored the page's dates on the cached job
  let posting = sanitizePosting(application.posting);
  if (!posting && text(application.jobId)) {
    const job = await db.collection("jobs").doc(text(application.jobId)).get();
    posting = sanitizePosting(job.get("posting"));
  }
  // When the user saved it, not when this trigger ran
  const seenAt = application.createdAt instanceof Timestamp ? application.createdAt.toMillis() : Date.now();

  const link = canonicalJobUrl(text(application.jobDescriptionLink)) ?? undefined;
  await updateJobSignals(hash, (previous) => observeJob(previous, {
    key,
    link,
    company: text(application.companyName),
    title: text(application.position),
    posting,
    seenAt,
  }));
  return hash;
}

/**
 * Rewrites a job's private signals with `update` and recomputes its public
 * signs, in one transaction.
 */
export async function updateJobSignals(
  hash: string,
  update: (previous: PrivateJobSignals | undefined) => PrivateJobSignals,
): Promise<void> {
  const privateRef = db.collection("jobSignalsPrivate").doc(hash);
  const publicRef = db.collection("jobSignals").doc(hash);
  await db.runTransaction(async (transaction) => {
    const previous = (await transaction.get(privateRef)).data() as PrivateJobSignals | undefined;
    const signals = update(previous);
    const sameRole = signals.companyTitleKey
      ? (await transaction.get(
        db.collection("jobSignalsPrivate").where("companyTitleKey", "==", signals.companyTitleKey).limit(50),
      )).docs.map((doc) => ({ key: text(doc.get("key")), firstSeenAt: text(doc.get("firstSeenAt")) }))
      : [];

    transaction.set(privateRef, signals);
    // mergeFields: reports and the admin's hidden flag live on the same doc
    transaction.set(
      publicRef,
      {
        v: 1,
        keyPrefix: jobKeyPrefix(hash),
        signs: publicSigns(signals, sameRole),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { mergeFields: ["v", "keyPrefix", "signs", "updatedAt"] },
    );
  });
}

// Every saved job feeds the public ghost-job signals of its posting. The
// application keeps the key hash so the app can read those signals.
export const jobSignals = onDocumentWritten("jobApplications/{applicationId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!shouldRecordJobSignals(before, after) || !after) return;

  const hash = await recordJobSignals(after);
  if (hash && after.jobKeyHash !== hash) {
    await event.data?.after.ref.update({ jobKeyHash: hash });
  }
});
