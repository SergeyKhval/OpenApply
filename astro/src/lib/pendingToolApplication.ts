// Hands a job and its match check from the landing page tool to the app.
// The app (spa/src/composables/pendingToolApplication.ts) creates the job
// application from it right after sign-in. Landing and app share an origin,
// so localStorage carries it through signup without storing anything server-side.
export const PENDING_TOOL_APPLICATION_KEY = "oa-pending-tool-application";

export type PendingToolApplication = {
  version: 1;
  savedAt: string;
  companyName: string;
  position: string;
  jobDescription: string;
  technologies: string[];
  // The posting's URL, when the check started from the browser extension
  jobDescriptionLink?: string;
  match: {
    matchScore: number;
    verdict: string;
    parseCheck: { status: "clean" | "issues" | "scrambled"; note: string };
    requirements: {
      requirement: string;
      status: "matched" | "partial" | "missing";
      importance: "must-have" | "nice-to-have";
      evidence: string;
    }[];
    missingKeywords: string[];
    fixes: { gap: string; where: string; action: string }[];
  };
};

export function savePendingToolApplication(
  pending: Omit<PendingToolApplication, "version" | "savedAt">,
): boolean {
  try {
    const entry: PendingToolApplication = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...pending,
    };
    localStorage.setItem(PENDING_TOOL_APPLICATION_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}
