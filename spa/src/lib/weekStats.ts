import type { JobApplication } from "@/types";
import { toJsDate } from "@/lib/jobDates";

export type WeekStats = {
  appliedThisWeek: number;
  interviewsThisWeek: number;
  offersThisWeek: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_JOBS_TO_SHOW = 3;

function inLastWeek(date: Date | null, now: Date): boolean {
  if (!date) return false;
  const age = now.getTime() - date.getTime();
  return age >= 0 && age < WEEK_MS;
}

// Counts, not rates: a "3% interview rate" reads as discouraging, a count doesn't
export function computeWeekStats(jobs: JobApplication[], now: Date): WeekStats {
  return jobs.reduce<WeekStats>(
    (stats, job) => ({
      appliedThisWeek: stats.appliedThisWeek + (inLastWeek(toJsDate(job.appliedAt), now) ? 1 : 0),
      interviewsThisWeek:
        stats.interviewsThisWeek + (inLastWeek(toJsDate(job.interviewedAt), now) ? 1 : 0),
      offersThisWeek: stats.offersThisWeek + (inLastWeek(toJsDate(job.offeredAt), now) ? 1 : 0),
    }),
    { appliedThisWeek: 0, interviewsThisWeek: 0, offersThisWeek: 0 },
  );
}

export function formatWeekStatsRow(stats: WeekStats): string {
  return `Applied this week ${stats.appliedThisWeek} · Interviews ${stats.interviewsThisWeek} · Offers ${stats.offersThisWeek}`;
}

// Too few jobs and the counts are mostly zeros, not worth a row
export function shouldShowWeekStats(totalJobs: number): boolean {
  return totalJobs >= MIN_JOBS_TO_SHOW;
}
