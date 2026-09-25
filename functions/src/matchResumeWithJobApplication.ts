import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { assertAiAllowance, chargeAiCheck } from "./lib/aiUsage";
import { analyzeResumeMatch, toStoredMatchResult } from "./lib/matchEngine";
import { validateResourceOwnership } from "./lib/ownership";
import { validateResumeForGeneration } from "./lib/validation";

defineString("GEMINI_API_KEY");

const db = getFirestore();

export const matchResumeWithJobApplication = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = request.auth.uid;
  const { resumeId, applicationId } = request.data;

  if (!resumeId || !applicationId) {
    throw new HttpsError(
      "invalid-argument",
      "resumeId and applicationId are required",
    );
  }

  try {
    await assertAiAllowance(userId);

    // Fetch data
    const [resume, jobApplication] = await Promise.all([
      db.collection("userResumes").doc(resumeId).get(),
      db.collection("jobApplications").doc(applicationId).get(),
    ]);

    const resumeData = resume.data();
    const jobApplicationData = jobApplication.data();

    // Validate existence first, then ownership, then data quality
    if (!resumeData) {
      throw new HttpsError("not-found", "Resume not found");
    }
    if (!jobApplicationData) {
      throw new HttpsError("not-found", "Job application not found");
    }

    validateResourceOwnership(resumeData as { userId: string }, userId);
    validateResourceOwnership(jobApplicationData as { userId: string }, userId);

    validateResumeForGeneration(resumeData as { text?: string });
    if (!jobApplicationData.jobDescription) {
      throw new HttpsError("failed-precondition", "Job application is missing job description");
    }

    // Same engine as the free tool: evidence not verbatim in the resume is
    // downgraded to missing before anything is stored
    const analysis = await analyzeResumeMatch({
      resumeText: resumeData.text,
      jobDescription: jobApplicationData.jobDescription,
    });

    // Save the match and count the AI check in one transaction
    const matchRef = db.collection("resumeJobMatches").doc();

    await db.runTransaction(async (transaction) => {
      await chargeAiCheck(transaction, userId);

      transaction.create(matchRef, {
        userId,
        resumeId,
        jobApplicationId: applicationId,
        matchResult: toStoredMatchResult(analysis),
        analysis,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error generating resume match:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate AI review";
    throw new HttpsError("internal", errorMessage);
  }
});
