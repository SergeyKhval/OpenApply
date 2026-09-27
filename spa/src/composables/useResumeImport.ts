import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { importErrorMessage } from "@/lib/resumeImport";

export type ResumeImportInput =
  | { source: "resume"; resumeId: string }
  | { source: "linkedin_pdf"; pdfBase64: string }
  | { source: "linkedin_paste"; text: string };

type ImportStats = {
  sections: number;
  entries: number;
  fieldsVerified: number;
  fieldsFlagged: number;
  bulletsImported: number;
  bulletsUnsorted: number;
  linesSkipped: number;
};

type ImportResponse = { resumeId: string; fallback: boolean; stats: ImportStats };

/**
 * Starts a built resume from an uploaded PDF or LinkedIn through the
 * importResume callable, which creates the doc. Returns its id, or throws
 * an Error whose message is fit to show.
 */
export async function importResume(input: ResumeImportInput): Promise<string> {
  trackEvent("resume_builder_started", { source: input.source });
  const started = Date.now();
  try {
    const { data } = await httpsCallable<ResumeImportInput, ImportResponse>(functions, "importResume", { timeout: 130_000 })(input);
    const { stats } = data;
    trackEvent("resume_import_completed", {
      source: input.source,
      fieldsVerified: stats.fieldsVerified,
      fieldsFlagged: stats.fieldsFlagged,
      bulletsImported: stats.bulletsImported,
      bulletsUnsorted: stats.bulletsUnsorted,
      linesSkipped: stats.linesSkipped,
      fallback: data.fallback,
      durationMs: Date.now() - started,
    });
    return data.resumeId;
  } catch (error) {
    const { message, code } = importErrorMessage(error);
    const status = (error as { code?: string })?.code?.replace(/^functions\//, "") ?? "unknown";
    trackEvent("resume_import_failed", { source: input.source, error: status, ...(code !== status ? { code } : {}) });
    throw new Error(message);
  }
}
