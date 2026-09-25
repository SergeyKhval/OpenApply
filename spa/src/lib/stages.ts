import type { JobStatus } from "@/types";

// Board stages are labels over the stored `status` values, which don't change:
// draft -> Saved, offered -> Offer, and hired/rejected/withdrew/archived all
// live in Closed with the status as the reason.
export type OpenStage = "saved" | "applied" | "interviewing" | "offer";
export type Stage = OpenStage | "closed";
export type ClosedReason = "hired" | "rejected" | "withdrew" | "archived";

export const OPEN_STAGES: OpenStage[] = ["saved", "applied", "interviewing", "offer"];
export const CLOSED_REASONS: ClosedReason[] = ["hired", "rejected", "withdrew", "archived"];

export const STAGE_LABELS: Record<Stage, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};

export const CLOSED_REASON_LABELS: Record<ClosedReason, string> = {
  hired: "Hired",
  rejected: "Rejected",
  withdrew: "Withdrew",
  archived: "Archived",
};

const STATUS_TO_STAGE: Partial<Record<JobStatus, Stage>> = {
  draft: "saved",
  applied: "applied",
  interviewing: "interviewing",
  offered: "offer",
  hired: "closed",
  rejected: "closed",
  withdrew: "closed",
  archived: "closed",
};

const STAGE_TO_STATUS: Record<OpenStage, JobStatus> = {
  saved: "draft",
  applied: "applied",
  interviewing: "interviewing",
  offer: "offered",
};

// Unknown values fall back to Saved so a job never vanishes from the board
export const stageOf = (status: JobStatus): Stage => STATUS_TO_STAGE[status] ?? "saved";

export const closedReason = (status: JobStatus): ClosedReason | null =>
  (CLOSED_REASONS as string[]).includes(status) ? (status as ClosedReason) : null;

export const statusForStage = (stage: OpenStage): JobStatus => STAGE_TO_STATUS[stage];

export const isOpenStage = (stage: Stage): stage is OpenStage => stage !== "closed";
