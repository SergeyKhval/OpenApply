import type { JobApplication } from "@/types";
import { CLOSED_REASON_LABELS, closedReason, STAGE_LABELS, stageOf } from "@/lib/stages";

// Stored dates come in three shapes: Firestore Timestamps, JS Dates written
// straight from the client, and CalendarDates in older types. All three have,
// or are, a way to get a Date.
type DateLike =
  | Date
  | { toDate(timeZone?: string): Date | null }
  | null
  | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const withToDate = value as Exclude<DateLike, Date | null | undefined>;
  if (typeof withToDate.toDate !== "function") return null;
  return withToDate.toDate(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? null;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const daysBetween = (earlier: Date, later: Date) =>
  Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);

export function daysAgoLabel(date: Date, now: Date) {
  const days = daysBetween(date, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function stageStartedAt(job: JobApplication): Date | null {
  const byStatus: Partial<Record<JobApplication["status"], unknown>> = {
    applied: job.appliedAt,
    interviewing: job.interviewedAt,
    offered: job.offeredAt,
    hired: job.hiredAt,
    archived: job.archivedAt,
  };
  const fromStage = job.status === "draft" ? job.createdAt : byStatus[job.status];
  return toJsDate(fromStage) ?? toJsDate(job.updatedAt) ?? toJsDate(job.createdAt);
}

// "Saved 6 days ago", "Interviewing since yesterday", "Rejected 2 days ago"
export function stageSinceLabel(job: JobApplication, now: Date) {
  const since = stageStartedAt(job);
  const stage = stageOf(job.status);
  const reason = closedReason(job.status);
  const name = reason ? CLOSED_REASON_LABELS[reason] : STAGE_LABELS[stage];
  if (!since) return name;
  const ago = daysAgoLabel(since, now);
  return stage === "interviewing" && ago !== "today" ? `${name} since ${ago}` : `${name} ${ago}`;
}

// "Follow up today" (due or overdue), "Follow up Mon" this week, "Follow up 12 Oct" later
export function followUpLabel(job: JobApplication, now: Date) {
  if (stageOf(job.status) === "closed") return null;
  const dueAt = toJsDate(job.followUpAt);
  if (!dueAt) return null;
  const inDays = daysBetween(now, dueAt);
  if (inDays <= 0) return { text: "Follow up today", due: true };
  if (inDays === 1) return { text: "Follow up tomorrow", due: false };
  if (inDays < 7) return { text: `Follow up ${WEEKDAYS[dueAt.getDay()]}`, due: false };
  return { text: `Follow up ${dueAt.getDate()} ${MONTHS[dueAt.getMonth()]}`, due: false };
}
