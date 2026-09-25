import type { JobApplication } from "@/types";

// How many jobs each resume was used for (jobApplications.resumeId)
export function countResumeUsage(jobs: JobApplication[]) {
  const usage = new Map<string, number>();
  for (const job of jobs) {
    if (job.resumeId) usage.set(job.resumeId, (usage.get(job.resumeId) ?? 0) + 1);
  }
  return usage;
}

export const usageLabel = (count: number) =>
  count === 0 ? "Not used yet" : `Used in ${count} ${count === 1 ? "job" : "jobs"}`;

export function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
}
