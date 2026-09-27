export type ResumeUploadState = {
  isReadingPdf: boolean;
  resumeSource: "paste" | "pdf";
  fileName: string | null;
};

/** What the Upload PDF control should read, given the current upload state. */
export function resumeUploadLabel(state: ResumeUploadState): string {
  if (state.isReadingPdf) return "Reading PDF…";
  if (state.resumeSource === "pdf" && state.fileName) return state.fileName;
  return "Upload PDF";
}
