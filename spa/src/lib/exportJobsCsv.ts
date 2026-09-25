import type { JobApplication } from "@/types";
import { toJsDate } from "@/lib/jobDates";
import { CLOSED_REASON_LABELS, closedReason, STAGE_LABELS, stageOf } from "@/lib/stages";

// Settings > Import and export: every job as CSV, the "your data stays yours" promise
const HEADER = ["Company", "Role", "Stage", "Closed reason", "Work", "Link", "Saved", "Applied", "Follow up", "Notes"];

const isoDate = (value: unknown) => {
  const date = toJsDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function cell(value: string) {
  // Spreadsheets run cells starting with these as formulas
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function jobsToCsv(jobs: JobApplication[], notesByJob: Map<string, string[]>) {
  const rows = jobs.map((job) => {
    const reason = closedReason(job.status);
    return [
      job.companyName,
      job.position,
      STAGE_LABELS[stageOf(job.status)],
      reason ? CLOSED_REASON_LABELS[reason] : "",
      job.remotePolicy ?? "",
      job.jobDescriptionLink ?? "",
      isoDate(job.createdAt),
      isoDate(job.appliedAt),
      isoDate(job.followUpAt),
      (notesByJob.get(job.id) ?? []).join(" | "),
    ];
  });
  return [HEADER, ...rows].map((row) => row.map((value) => cell(String(value ?? ""))).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel reads UTF-8 names correctly
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
