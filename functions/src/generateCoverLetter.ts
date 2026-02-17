import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { firestore } from "firebase-admin";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash", { temperature: 0.7, topK: 40 }),
});

const db = getFirestore();

const REQUIRED_CREDITS = 10;

const billingProfileRefForUser = (userId: string) =>
  db
    .collection("users")
    .doc(userId)
    .collection("billingProfile")
    .doc("profile");

export const createInsufficientCreditsError = (action: "generate" | "regenerate") =>
  new HttpsError(
    "failed-precondition",
    `You need at least ${REQUIRED_CREDITS} coins to ${action} a cover letter.`,
    { code: "insufficient-credits" },
  );

defineString("GEMINI_API_KEY");

interface GenerateCoverLetterRequest {
  jobApplicationId: string;
  resumeId: string;
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

async function validateBillingBalance(
  userId: string,
  action: "generate" | "regenerate",
): Promise<void> {
  const billingProfileRef = billingProfileRefForUser(userId);
  const billingSnapshot = await billingProfileRef.get();

  if (!billingSnapshot.exists) {
    throw new HttpsError("failed-precondition", "Billing profile not found");
  }

  const currentBalance = billingSnapshot.data()?.currentBalance ?? 0;

  if (currentBalance < REQUIRED_CREDITS) {
    throw createInsufficientCreditsError(action);
  }
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
  if (jobApplication?.userId !== userId) {
    throw new HttpsError(
      "permission-denied",
      "User does not have access to this job application",
    );
  }

  return jobApplication as firestore.DocumentData;
}

async function fetchAndValidateResume(resumeId: string, userId: string) {
  const resumeDoc = await db.collection("userResumes").doc(resumeId).get();

  if (!resumeDoc.exists) {
    throw new HttpsError("not-found", "Resume not found");
  }

  const resume = resumeDoc.data();
  if (resume?.userId !== userId) {
    throw new HttpsError(
      "permission-denied",
      "User does not have access to this resume",
    );
  }

  if (!resume.text) {
    throw new HttpsError(
      "failed-precondition",
      "Resume has not been parsed yet",
    );
  }

  return resume as firestore.DocumentData;
}

async function buildCoverLetterPrompt(
  jobApplication: firestore.DocumentData,
  resume: firestore.DocumentData,
): Promise<string> {
  const promptTemplates = db.collection("promptTemplates").doc("coverLetter");
  const promptTemplateDoc = await promptTemplates.get();
  const coverLetterTemplate =
    promptTemplateDoc.exists && promptTemplateDoc.data();

  if (!coverLetterTemplate) return "";

  return coverLetterTemplate.template
    .replace("{{ companyName }}", jobApplication.companyName)
    .replace("{{ position }}", jobApplication.position)
    .replace("{{ resumeText }}", resume.text)
    .replace("{{ jobDescription }}", jobApplication.jobDescription);
}

async function generateCoverLetterWithAI(
  jobApplication: firestore.DocumentData,
  resume: firestore.DocumentData,
): Promise<string> {
  const prompt = await buildCoverLetterPrompt(jobApplication, resume);
  const result = await ai.generate({ prompt });
  return result.text.trim();
}

async function deductCreditsInTransaction(
  userId: string,
  action: "generate" | "regenerate",
  transactionCallback: (transaction: FirebaseFirestore.Transaction) => void,
): Promise<void> {
  const billingProfileRef = billingProfileRefForUser(userId);

  await db.runTransaction(async (transaction) => {
    const billingSnap = await transaction.get(billingProfileRef);

    if (!billingSnap.exists) {
      throw new HttpsError("failed-precondition", "Billing profile not found");
    }

    const currentBalance = billingSnap.data()?.currentBalance ?? 0;

    if (currentBalance < REQUIRED_CREDITS) {
      throw createInsufficientCreditsError(action);
    }

    transactionCallback(transaction);

    transaction.update(billingProfileRef, {
      currentBalance: FieldValue.increment(-REQUIRED_CREDITS),
      updatedAt: FieldValue.serverTimestamp(),
    });
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

    try {
      await validateBillingBalance(userId, "generate");

      const jobApplication = await fetchAndValidateJobApplication(
        jobApplicationId,
        userId,
      );
      const resume = await fetchAndValidateResume(resumeId, userId);

      const coverLetterBody = await generateCoverLetterWithAI(
        jobApplication,
        resume,
      );

      const coverLetterRef = db.collection("coverLetters").doc();
      const jobApplicationRef = db
        .collection("jobApplications")
        .doc(jobApplicationId);

      await deductCreditsInTransaction(userId, "generate", (transaction) => {
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
          modelMetadata: {
            model: "gemini-2.5-flash",
            temperature: 0.7,
            prompt: "cover-letter-v1",
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
}>(async (request) => {
  const userId = validateAuth(request);
  const { coverLetterId, jobApplicationId, resumeId } = request.data;

  if (!coverLetterId || !jobApplicationId || !resumeId) {
    throw new HttpsError(
      "invalid-argument",
      "coverLetterId, jobApplicationId and resumeId are required",
    );
  }

  try {
    await validateBillingBalance(userId, "regenerate");

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

    const newBody = await generateCoverLetterWithAI(jobApplication, resume);

    const coverLetterRef = db.collection("coverLetters").doc(coverLetterId);

    await deductCreditsInTransaction(userId, "regenerate", (transaction) => {
      transaction.update(coverLetterRef, {
        body: newBody,
        updatedAt: FieldValue.serverTimestamp(),
        modelMetadata: {
          model: "gemini-2.5-flash",
          temperature: 0.7,
          prompt: "cover-letter-v1",
        },
      });
    });

    return { body: newBody };
  } catch (error) {
    handleError(error, "regenerating");
  }
});
