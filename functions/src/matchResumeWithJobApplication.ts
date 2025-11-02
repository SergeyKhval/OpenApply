import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { defineString } from "firebase-functions/params";

defineString("GEMINI_API_KEY");

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash", { temperature: 0, topK: 1 }),
});
const db = getFirestore();

const REQUIRED_CREDITS = 10;

const billingProfileRefForUser = (userId: string) =>
  db
    .collection("users")
    .doc(userId)
    .collection("billingProfile")
    .doc("profile");

const createInsufficientCreditsError = () =>
  new HttpsError(
    "failed-precondition",
    `You need at least ${REQUIRED_CREDITS} coins to generate an AI resume review.`,
    { code: "insufficient-credits" },
  );

// Define the schema for the resume and job description match result
const ResumeJDMatchSchema = z.object({
  match_summary: z.object({
    overall_match_percent: z.number().int(),
    summary: z.string(),
  }),

  skills_comparison: z.object({
    matched_skills: z
      .array(
        z.object({
          skill: z.string(),
          status: z.enum(["matched"]),
          evidence: z.string(),
        }),
      )
      .optional(),
    partially_matched_skills: z
      .array(
        z.object({
          skill: z.string(),
          status: z.enum(["partial"]),
          evidence: z.string(),
        }),
      )
      .optional(),
    missing_skills: z
      .array(
        z.object({
          skill: z.string(),
          status: z.enum(["missing"]),
        }),
      )
      .optional(),
  }),

  requirements_comparison: z
    .array(
      z.object({
        requirement: z.string(),
        match: z.enum(["matched", "partial", "missing"]),
        note: z.string().optional(),
      }),
    )
    .optional(),

  recommendations: z.object({
    improvement_areas: z.array(z.string()).optional(),
    potential_match_boost: z.string().optional(),
  }),
});

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
    // Validate billing balance
    const billingProfileRef = billingProfileRefForUser(userId);
    const billingSnapshot = await billingProfileRef.get();

    if (!billingSnapshot.exists) {
      throw new HttpsError("failed-precondition", "Billing profile not found");
    }

    const currentBalance = billingSnapshot.data()?.currentBalance ?? 0;

    if (currentBalance < REQUIRED_CREDITS) {
      throw createInsufficientCreditsError();
    }

    // Fetch data
    const [resumeMatchPromptTemplate, resume, jobApplication] =
      await Promise.all([
        db.collection("promptTemplates").doc("resumeMatcher").get(),
        db.collection("userResumes").doc(resumeId).get(),
        db.collection("jobApplications").doc(applicationId).get(),
      ]);

    const promptTemplateData = resumeMatchPromptTemplate.data();
    const resumeData = resume.data();
    const jobApplicationData = jobApplication.data();

    // Validate ownership
    if (resumeData?.userId !== userId) {
      throw new HttpsError(
        "permission-denied",
        "User does not have access to this resume",
      );
    }

    if (jobApplicationData?.userId !== userId) {
      throw new HttpsError(
        "permission-denied",
        "User does not have access to this job application",
      );
    }

    if (
      !promptTemplateData ||
      !resumeData ||
      !jobApplicationData ||
      !resumeData.text ||
      !jobApplicationData.jobDescription
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Invalid data for resume or job application",
      );
    }

    const prompt = promptTemplateData.template
      .replace("{{ resumeText }}", resumeData.text)
      .replace("{{ jobDescriptionText }}", jobApplicationData.jobDescription);

    const result = await ai.generate({
      prompt,
      output: {
        schema: ResumeJDMatchSchema,
        format: "json",
      },
    });

    // Create match result and deduct credits in a transaction
    const matchRef = db.collection("resumeJobMatches").doc();

    await db.runTransaction(async (transaction) => {
      const billingSnap = await transaction.get(billingProfileRef);

      if (!billingSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Billing profile not found",
        );
      }

      const currentBalance = billingSnap.data()?.currentBalance ?? 0;

      if (currentBalance < REQUIRED_CREDITS) {
        throw createInsufficientCreditsError();
      }

      transaction.create(matchRef, {
        userId,
        resumeId,
        jobApplicationId: applicationId,
        matchResult: result.output,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(billingProfileRef, {
        currentBalance: FieldValue.increment(-REQUIRED_CREDITS),
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
