import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { firestore } from "firebase-admin";
import { assertAiAllowance, chargeAiCheck } from "./lib/aiUsage";
import { validateResourceOwnership } from "./lib/ownership";
import { validateResumeForGeneration, validateJobApplicationForGeneration } from "./lib/validation";
import { parseCoverLetterStyle, promptVersion, styleInstructions, type CoverLetterStyle } from "./lib/coverLetterStyle";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash", { temperature: 0.7, topK: 40 }),
});

const db = getFirestore();

defineString("GEMINI_API_KEY");

interface GenerateCoverLetterRequest {
  jobApplicationId: string;
  resumeId: string;
  length?: string;
  tone?: string;
}

interface GenerateCoverLetterResponse {
  coverLetterId: string;
  body: string;
}

export function validateAuth(request: { auth?: { uid: string } }): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  return request.auth.uid;
}

async function fetchAndValidateJobApplication(
  jobApplicationId: string,
  userId: string,
) {
  const jobApplicationDoc = await db
    .collection("jobApplications")
    .doc(jobApplicationId)
    .get();

  if (!jobApplicationDoc.exists) {
    throw new HttpsError("not-found", "Job application not found");
  }

  const jobApplication = jobApplicationDoc.data();
  validateResourceOwnership(jobApplication as { userId: string }, userId);
  validateJobApplicationForGeneration(jobApplication as {
    companyName?: string;
    position?: string;
    jobDescription?: string;
  });

  return jobApplication as firestore.DocumentData;
}

async function fetchAndValidateResume(resumeId: string, userId: string) {
  const resumeDoc = await db.collection("userResumes").doc(resumeId).get();

  if (!resumeDoc.exists) {
    throw new HttpsError("not-found", "Resume not found");
  }

  const resume = resumeDoc.data();
  validateResourceOwnership(resume as { userId: string }, userId);
  validateResumeForGeneration(resume as { text?: string });

  return resume as firestore.DocumentData;
}

async function buildCoverLetterPrompt(
  jobApplication: firestore.DocumentData,
  resume: firestore.DocumentData,
  style: CoverLetterStyle,
): Promise<string> {
  const promptTemplates = db.collection("promptTemplates").doc("coverLetter");
  const promptTemplateDoc = await promptTemplates.get();
  const coverLetterTemplate =
    promptTemplateDoc.exists && promptTemplateDoc.data();

  if (!coverLetterTemplate) {
    throw new HttpsError("failed-precondition", "Cover letter prompt template not found");
  }

  return coverLetterTemplate.template
    .replace("{{ companyName }}", jobApplication.companyName)
    .replace("{{ position }}", jobApplication.position)
    .replace("{{ resumeText }}", resume.text)
    .replace("{{ jobDescription }}", jobApplication.jobDescription) + styleInstructions(style);
}

async function generateCoverLetterWithAI(
  jobApplication: firestore.DocumentData,
  resume: firestore.DocumentData,
  style: CoverLetterStyle,
): Promise<string> {
  const prompt = await buildCoverLetterPrompt(jobApplication, resume, style);
  const result = await ai.generate({ prompt });
  return result.text.trim();
}

async function chargeAndSave(
  userId: string,
  transactionCallback: (transaction: FirebaseFirestore.Transaction) => void,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    await chargeAiCheck(transaction, userId);
    transactionCallback(transaction);
  });
}

export function handleError(
  error: unknown,
  action: "generating" | "regenerating",
): never {
  console.error(`Error ${action} cover letter:`, error);

  if (error instanceof HttpsError) {
    throw error;
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : `Failed to ${action === "generating" ? "generate" : "regenerate"} cover letter`;
  throw new HttpsError("internal", errorMessage);
}

// Main functions

export const generateCoverLetter = onCall<GenerateCoverLetterRequest>(
  async (request) => {
    const userId = validateAuth(request);
    const { jobApplicationId, resumeId } = request.data;

    if (!jobApplicationId || !resumeId) {
      throw new HttpsError(
        "invalid-argument",
        "jobApplicationId and resumeId are required",
      );
    }
    const style = parseCoverLetterStyle(request.data);

    try {
      await assertAiAllowance(userId);

      const jobApplication = await fetchAndValidateJobApplication(
        jobApplicationId,
        userId,
      );
      const resume = await fetchAndValidateResume(resumeId, userId);

      const coverLetterBody = await generateCoverLetterWithAI(
        jobApplication,
        resume,
        style,
      );

      const coverLetterRef = db.collection("coverLetters").doc();
      const jobApplicationRef = db
        .collection("jobApplications")
        .doc(jobApplicationId);

      await chargeAndSave(userId, (transaction) => {
        transaction.create(coverLetterRef, {
          userId,
          jobApplication: {
            id: jobApplicationId,
            companyName: jobApplication?.companyName,
            position: jobApplication?.position,
            companyLogoUrl: jobApplication?.companyLogoUrl || null,
          },
          resumeId,
          body: coverLetterBody,
          createdAt: FieldValue.serverTimestamp(),
          style,
          modelMetadata: {
            model: "gemini-2.5-flash",
            temperature: 0.7,
            prompt: promptVersion(style),
          },
        });

        transaction.update(jobApplicationRef, {
          coverLetterId: coverLetterRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return {
        coverLetterId: coverLetterRef.id,
        body: coverLetterBody,
      } as GenerateCoverLetterResponse;
    } catch (error) {
      handleError(error, "generating");
    }
  },
);

export const regenerateCoverLetter = onCall<{
  coverLetterId: string;
  jobApplicationId: string;
  resumeId: string;
  length?: string;
  tone?: string;
}>(async (request) => {
  const userId = validateAuth(request);
  const { coverLetterId, jobApplicationId, resumeId } = request.data;

  if (!coverLetterId || !jobApplicationId || !resumeId) {
    throw new HttpsError(
      "invalid-argument",
      "coverLetterId, jobApplicationId and resumeId are required",
    );
  }
  const style = parseCoverLetterStyle(request.data);

  try {
    await assertAiAllowance(userId);

    // Verify cover letter ownership
    const coverLetterDoc = await db
      .collection("coverLetters")
      .doc(coverLetterId)
      .get();

    if (!coverLetterDoc.exists) {
      throw new HttpsError("not-found", "Cover letter not found");
    }

    const coverLetter = coverLetterDoc.data();
    if (coverLetter?.userId !== userId) {
      throw new HttpsError(
        "permission-denied",
        "User does not have access to this cover letter",
      );
    }

    const jobApplication = await fetchAndValidateJobApplication(
      jobApplicationId,
      userId,
    );
    const resume = await fetchAndValidateResume(resumeId, userId);

    const newBody = await generateCoverLetterWithAI(jobApplication, resume, style);

    const coverLetterRef = db.collection("coverLetters").doc(coverLetterId);

    await chargeAndSave(userId, (transaction) => {
      transaction.update(coverLetterRef, {
        body: newBody,
        updatedAt: FieldValue.serverTimestamp(),
        style,
        modelMetadata: {
          model: "gemini-2.5-flash",
          temperature: 0.7,
          prompt: promptVersion(style),
        },
      });
    });

    return { body: newBody };
  } catch (error) {
    handleError(error, "regenerating");
  }
});
