import { HttpsError } from "firebase-functions/v2/https";

/**
 * Validates that a resume has parsed text available for AI generation.
 */
export function validateResumeForGeneration(resume: { text?: string | null }): void {
  if (!resume.text) {
    throw new HttpsError("failed-precondition", "Resume has not been parsed yet");
  }
}

/**
 * Validates that a job application has the required fields for AI generation.
 * This is new validation — previously these fields were silently undefined in prompts.
 */
export function validateJobApplicationForGeneration(app: {
  companyName?: string;
  position?: string;
  jobDescription?: string;
}): void {
  if (!app.companyName) {
    throw new HttpsError("failed-precondition", "Job application is missing company name");
  }
  if (!app.position) {
    throw new HttpsError("failed-precondition", "Job application is missing position");
  }
  if (!app.jobDescription) {
    throw new HttpsError("failed-precondition", "Job application is missing job description");
  }
}
