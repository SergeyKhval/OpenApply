import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { assertAiAllowance, chargeAiCheck } from "./lib/aiUsage";
import { validateResourceOwnership } from "./lib/ownership";
import { validateResumeForGeneration } from "./lib/validation";
import { TAILOR_MODEL, TAILOR_PROMPT_VERSION, tailorResume } from "./lib/tailorEngine";
import { hashResumeText } from "./lib/tailorSegment";
import { assertTailorAllowed, assertTailorWithinLimits } from "./lib/tailorAccess";
import { rateLimitWindows } from "./lib/matchTool";

defineString("GEMINI_API_KEY");

const db = getFirestore();

// Counters only need to outlive their window; a TTL policy on expiresAt
// (firestore.indexes.json) cleans them up
const RATE_LIMIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

// Every attempt counts, including ones that end with nothing to change:
// those are free to the user but not to us
async function consumeTailorRateLimit(userId: string) {
  const now = new Date();
  const windows = rateLimitWindows(userId, now);
  const refs = {
    hourly: db.collection("tailorRateLimits").doc(windows.hourly),
    daily: db.collection("tailorRateLimits").doc(windows.daily),
    global: db.collection("tailorRateLimits").doc(windows.global),
  };
  const expiresAt = Timestamp.fromMillis(now.getTime() + RATE_LIMIT_TTL_MS);

  await db.runTransaction(async (transaction) => {
    const [hourly, daily, global] = await Promise.all([
      transaction.get(refs.hourly),
      transaction.get(refs.daily),
      transaction.get(refs.global),
    ]);
    assertTailorWithinLimits({
      hourly: hourly.data()?.count ?? 0,
      daily: daily.data()?.count ?? 0,
      global: global.data()?.count ?? 0,
    });
    for (const ref of Object.values(refs)) {
      transaction.set(ref, { count: FieldValue.increment(1), expiresAt }, { merge: true });
    }
  });
}

/**
 * Tailors a resume to one job from the newest match check of that resume
 * and job. The model proposes edits; tailorVerify keeps only the ones that
 * add nothing the resume doesn't state. Costs one AI check, and only when at
 * least one edit survives: "nothing to change" is free.
 */
export const createTailoredResume = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = request.auth.uid;
  const { resumeId, applicationId } = (request.data ?? {}) as Record<string, unknown>;
  if (typeof resumeId !== "string" || !resumeId || typeof applicationId !== "string" || !applicationId) {
    throw new HttpsError("invalid-argument", "resumeId and applicationId are required");
  }

  try {
    // Closed until rollout: the app's flag only hides the button
    const user = await db.collection("users").doc(userId).get();
    assertTailorAllowed(userId, user.get("admin") === true);

    const [resume, application] = await Promise.all([
      db.collection("userResumes").doc(resumeId).get(),
      db.collection("jobApplications").doc(applicationId).get(),
    ]);
    const resumeData = resume.data();
    const applicationData = application.data();
    if (!resumeData) {
      throw new HttpsError("not-found", "Resume not found");
    }
    if (!applicationData) {
      throw new HttpsError("not-found", "Job application not found");
    }
    validateResourceOwnership(resumeData as { userId: string }, userId);
    validateResourceOwnership(applicationData as { userId: string }, userId);
    validateResumeForGeneration(resumeData as { text?: string });

    // The tailor works from the match's requirements, so the match has to
    // be of this exact resume text
    const matches = await db
      .collection("resumeJobMatches")
      .where("userId", "==", userId)
      .where("resumeId", "==", resumeId)
      .where("jobApplicationId", "==", applicationId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    const match = matches.docs[0];
    const matchData = match?.data();
    if (!match || !matchData?.analysis) {
      throw new HttpsError("failed-precondition", "Check your resume against this job first.", { code: "no_match" });
    }
    const sourceTextHash = hashResumeText(resumeData.text);
    if (matchData.resumeTextHash !== sourceTextHash) {
      throw new HttpsError(
        "failed-precondition",
        "Your resume changed since the last check. Run the check again first.",
        { code: "stale_match" },
      );
    }

    await assertAiAllowance(userId);
    await consumeTailorRateLimit(userId);

    const started = Date.now();
    const result = await tailorResume({ resumeText: resumeData.text, analysis: matchData.analysis });
    // Counts and tokens only, never resume text
    console.log("createTailoredResume", {
      ...result.stats,
      usage: result.usage,
      durationMs: Date.now() - started,
    });

    if (result.stats.applied === 0) {
      return { tailoredResumeId: null, stats: result.stats };
    }

    const tailoredRef = db.collection("tailoredResumes").doc();
    await db.runTransaction(async (transaction) => {
      await chargeAiCheck(transaction, userId);
      transaction.create(tailoredRef, {
        userId,
        resumeId,
        jobApplicationId: applicationId,
        matchId: match.id,
        resume: { id: resumeId, fileName: resumeData.fileName ?? null },
        jobApplication: {
          id: applicationId,
          companyName: applicationData.companyName ?? null,
          position: applicationData.position ?? null,
        },
        sourceTextHash,
        lines: result.lines,
        sectionOrder: result.sectionOrder,
        ops: result.ops,
        excludedOpIds: [],
        stats: result.stats,
        usage: result.usage,
        model: TAILOR_MODEL,
        promptVersion: TAILOR_PROMPT_VERSION,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { tailoredResumeId: tailoredRef.id, stats: result.stats };
  } catch (error) {
    console.error("Error creating tailored resume:", error instanceof Error ? error.message : error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "The tailored version didn't finish. Nothing was counted; try again in a moment.");
  }
});
