import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { defineString } from "firebase-functions/params";
import { assertAiAllowance, chargeAiCheck } from "./lib/aiUsage";
import { validateResourceOwnership } from "./lib/ownership";
import { validateResumeForGeneration } from "./lib/validation";

defineString("GEMINI_API_KEY");

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash", { temperature: 0, topK: 1 }),
});
const db = getFirestore();

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
    await assertAiAllowance(userId);

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

    // Validate existence first, then ownership, then data quality
    if (!promptTemplateData) {
      throw new HttpsError("failed-precondition", "Resume matcher prompt template not found");
    }
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

    // Save the match and count the AI check in one transaction
    const matchRef = db.collection("resumeJobMatches").doc();

    await db.runTransaction(async (transaction) => {
      await chargeAiCheck(transaction, userId);

      transaction.create(matchRef, {
        userId,
        resumeId,
        jobApplicationId: applicationId,
        matchResult: result.output,
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
