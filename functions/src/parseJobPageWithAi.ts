import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { firestore } from "firebase-admin";

defineString("GEMINI_API_KEY");

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash", { temperature: 0, topK: 1 }),
});
const db = getFirestore();

// Define the Job schema for structured extraction
const JobSchema = z.object({
  companyName: z.string().optional(),
  position: z.string().optional(),
  description: z.string().optional(),
  companyLogoUrl: z.string().optional(),
  employmentType: z.enum(["full-time", "part-time"]).optional(),
  technologies: z.array(z.string()).optional(),
  remotePolicy: z.enum(["remote", "in-office", "hybrid"]).optional(),
});

type Job = z.infer<typeof JobSchema>;

async function buildJobParserPrompt(
  job: firestore.DocumentData,
): Promise<string> {
  const jobParserTemplateDoc = await db
    .collection("promptTemplates")
    .doc("jobParser")
    .get();

  const jobParserTemplate =
    jobParserTemplateDoc.exists && jobParserTemplateDoc.data();

  if (!jobParserTemplate) return "";

  return jobParserTemplate.template.replace("{{ pageHtml }}", job.content);
}

export const parseJobPageWithAi = onDocumentWritten(
  "jobs/{docId}",
  async (event) => {
    const data = event.data?.after.data();

    if (!data) {
      console.log("No data in snapshot");
      return;
    }

    const docId = event.params.docId;

    // Check if the status is "scrapped" (meaning content has been scraped)
    if (data.status !== "scrapped") {
      console.log(
        `Job ${docId} status is '${data.status}', not 'scrapped'. Skipping AI parsing.`,
      );
      return;
    }

    // Check if content exists
    if (!data.content) {
      console.error(`Job ${docId} has status 'scrapped' but no content`);
      await db.collection("jobs").doc(docId).update({
        status: "parse-failed",
        errorMessage: "No content to parse",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    // Check if already parsed (in case of re-trigger)
    if (data.status === "parsed" || data.parsedData) {
      console.log(`Job ${docId} already parsed. Skipping.`);
      return;
    }

    try {
      // Update status to indicate parsing is in progress
      await db.collection("jobs").doc(docId).update({
        status: "parsing",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Create the prompt for structured extraction
      const prompt = await buildJobParserPrompt(data);

      // Call the AI to extract structured data
      const result = await ai.generate({
        prompt,
        output: {
          schema: JobSchema,
          format: "json",
        },
      });

      // Extract the parsed job data
      const parsedJob: Job = result.output as Job;

      // Update the document with parsed data
      await db.collection("jobs").doc(docId).update({
        status: "parsed",
        parsedData: parsedJob,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error parsing job ${docId}:`, error);

      let errorMessage = "Unknown error occurred during parsing";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      // Update document with parse failure status
      await db.collection("jobs").doc(docId).update({
        status: "parse-failed",
        errorMessage,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);
