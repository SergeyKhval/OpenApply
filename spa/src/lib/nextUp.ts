import type { JobApplication } from "@/types";
import { stageOf } from "@/lib/stages";

// "Next up" on the Jobs page (and, later, the Monday email): what needs doing
// this week, most urgent first. Pure, so the rules are easy to test.
export const STALE_SAVED_AFTER_DAYS = 5;
export const INTERVIEW_WINDOW_DAYS = 7;
export const NEXT_UP_LIMIT = 5;

export type NextUpInterview = {
  id: string;
  applicationId: string;
  name: string;
  conductedAt: Date;
  status?: string;
};

export type NextUpItem =
  | { kind: "follow-up"; job: JobApplication; dueAt: Date; overdueDays: number }
  | { kind: "interview"; job: JobApplication; interview: NextUpInterview }
  | { kind: "stale-saved"; job: JobApplication; savedDaysAgo: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const wholeDaysBetween = (earlier: Date, later: Date) =>
  Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);

const toDate = (value: { toDate(): Date } | null | undefined) => value?.toDate?.() ?? null;

export function buildNextUp(
  jobs: JobApplication[],
  interviews: NextUpInterview[],
  now: Date,
  limit = NEXT_UP_LIMIT,
): NextUpItem[] {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const interviewWindowEnd = new Date(today.getTime() + INTERVIEW_WINDOW_DAYS * DAY_MS);
  const openJobs = new Map(
    jobs.filter((job) => stageOf(job.status) !== "closed").map((job) => [job.id, job]),
  );

  const followUps = [...openJobs.values()]
    .filter((job) => stageOf(job.status) !== "saved")
    .flatMap((job) => {
      const dueAt = toDate(job.followUpAt);
      if (!dueAt || dueAt >= tomorrow) return [];
      return [{ kind: "follow-up" as const, job, dueAt, overdueDays: wholeDaysBetween(dueAt, now) }];
    })
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  const upcomingInterviews = interviews
    .filter(
      (interview) =>
        (interview.status ?? "pending") === "pending" &&
        interview.conductedAt >= today &&
        interview.conductedAt < interviewWindowEnd &&
        openJobs.has(interview.applicationId),
    )
    .sort((a, b) => a.conductedAt.getTime() - b.conductedAt.getTime())
    .map((interview) => ({
      kind: "interview" as const,
      job: openJobs.get(interview.applicationId)!,
      interview,
    }));

  const staleSaved = [...openJobs.values()]
    .filter((job) => job.status === "draft" && !toDate(job.followUpAt))
    .flatMap((job) => {
      const createdAt = toDate(job.createdAt);
      if (!createdAt) return [];
      const savedDaysAgo = wholeDaysBetween(createdAt, now);
      return savedDaysAgo > STALE_SAVED_AFTER_DAYS
        ? [{ kind: "stale-saved" as const, job, savedDaysAgo }]
        : [];
    })
    .sort((a, b) => b.savedDaysAgo - a.savedDaysAgo);

  return [...followUps, ...upcomingInterviews, ...staleSaved].slice(0, limit);
}
