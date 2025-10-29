import { getFirestore } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { z } from "genkit";

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
          status: z.literal("matched"),
          evidence: z.string(),
        }),
      )
      .optional(),
    partially_matched_skills: z
      .array(
        z.object({
          skill: z.string(),
          status: z.literal("partial"),
          evidence: z.string(),
        }),
      )
      .optional(),
    missing_skills: z
      .array(
        z.object({
          skill: z.string(),
          status: z.literal("missing"),
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
  const { resumeId, jobApplicationId } = request.data;

  if (!resumeId || !jobApplicationId) {
    throw new Error("Missing resumeId or jobApplicationId");
  }

  const [resumeMatchPromptTemplate, resume, jobApplication] = await Promise.all(
    [
      db.collection("promptTemplates").doc("resumeMatcher").get(),
      db.collection("userResumes").doc(resumeId).get(),
      db.collection("jobApplications").doc(jobApplicationId).get(),
    ],
  );
});
