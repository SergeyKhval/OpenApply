import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";

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

defineString("GEMINI_API_KEY");

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
      const prompt = `System Role
You are an expert data extraction model.
Your task is to parse the provided HTML content and return a single valid JSON object that conforms exactly to the schema below.
Output only raw JSON — no explanations, no markdown, no commentary.

Schema:
{
  "companyName": "string | null",
  "description": "string | null",
  "position": "string | null",
  "companyLogoUrl": "string | null",
  "employmentType": "full-time | part-time | null",
  "remotePolicy": "remote | in-office | hybrid | null",
  "technologies": ["string", ...]
}


Extraction Guidelines:
1. companyName
 - Extract from the visible job title area, company info block, or og:title / <title> tags.
 - If multiple candidates appear, choose the one directly associated with the posting.
 - If uncertain, return null.

2. companyLogoUrl
 - Prefer meta[property="og:image"], then any <img> or <link> tag clearly tied to the company or job page.
 - Ensure URL is absolute (resolve relative paths if necessary).
 - If no clear logo, return null.

3. position
 - Extract the job title from <h1> or relevant <title> / og:title tags.
 - Clean it of location or company name if appended.

4. employmentType
 - Detect mentions of full-time, part-time, or variants (case-insensitive).
 - Return one of "full-time", "part-time", or null.
 - Do not infer based on tone or seniority.

5. remotePolicy
 - Detect any indication of work model:
 - "remote" if fully remote,
 - "hybrid" if a mix of office and remote (e.g., “3 days per week in office”, “#LI-Hybrid”),
 - "in-office" if primarily on-site.
 - If absent or unclear, return null.

6. description
 - Extract the main textual content describing the position, responsibilities, requirements, qualifications, and culture.
 - Remove boilerplate like “Apply now” or “Privacy notice.”
 - If the text exceeds 1000 words, summarize while preserving all key responsibilities and qualifications.
 - Keep it concise but information-rich.

7. technologies
 - Extract explicit mentions of technical tools, programming languages, or methodologies (e.g., React, Python, Jira, Git, Scrum, AWS).
 - Return unique, normalized terms (capitalize proper names).
 - Omit duplicates and irrelevant nouns.

8. Missing or uncertain data
 - If information is missing or unclear, set the field to null.
 - Do not fabricate or guess values.
 - Always ensure the output is valid JSON that can be parsed without errors.


Parsing Context:
The HTML content below represents a job posting. Extract data only from the visible textual and metadata content relevant to the posting.
Ignore navigation, scripts, analytics, and unrelated footer text.
${data.content}`;

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
