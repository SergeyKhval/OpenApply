import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { defineString } from "firebase-functions/params";

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
    throw new Error("Authentication required");
  }

  const { resumeId, applicationId } = request.data;

  if (!resumeId || !applicationId) {
    throw new Error("Missing resumeId or applicationId");
  }

  const [resumeMatchPromptTemplate, resume, jobApplication] = await Promise.all(
    [
      db.collection("promptTemplates").doc("resumeMatcher").get(),
      db.collection("userResumes").doc(resumeId).get(),
      db.collection("jobApplications").doc(applicationId).get(),
    ],
  );

  const promptTemplateData = resumeMatchPromptTemplate.data();
  const resumeData = resume.data();
  const jobApplicationData = jobApplication.data();

  if (
    !promptTemplateData ||
    !resumeData ||
    !jobApplicationData ||
    !resumeData.text ||
    !jobApplicationData.jobDescription
  ) {
    throw new Error("Invalid data for resume or job application");
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

  await db.collection("resumeJobMatches").add({
    userId: request.auth?.uid,
    resumeId,
    jobApplicationId: applicationId,
    matchResult: result.output,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});
