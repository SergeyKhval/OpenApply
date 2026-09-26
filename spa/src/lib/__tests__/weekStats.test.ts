import { describe, expect, it } from "vitest";
import type { JobApplication } from "@/types";
import { computeWeekStats, formatWeekStatsRow, shouldShowWeekStats } from "../weekStats";

const NOW = new Date(2026, 8, 25, 10, 0); // Fri 25 Sep 2026, 10:00 local
const at = (dayOffset: number, hour = 9) => new Date(2026, 8, 25 + dayOffset, hour, 0);
const ts = (date: Date | null | undefined) => (date ? ({ toDate: () => date } as unknown) : undefined);

const job = (extra: Partial<Record<"appliedAt" | "interviewedAt" | "offeredAt", Date>> = {}) =>
  ({
    id: Math.random().toString(36),
    companyName: "Acme",
    position: "Engineer",
    status: "applied",
    appliedAt: ts(extra.appliedAt),
    interviewedAt: ts(extra.interviewedAt),
    offeredAt: ts(extra.offeredAt),
  }) as unknown as JobApplication;

describe("computeWeekStats", () => {
  it("counts stage transitions within the trailing 7 days", () => {
    const jobs = [
      job({ appliedAt: at(-1) }),
      job({ appliedAt: at(-6) }),
      job({ interviewedAt: at(-2) }),
      job({ offeredAt: at(0) }),
    ];
    expect(computeWeekStats(jobs, NOW)).toEqual({
      appliedThisWeek: 2,
      interviewsThisWeek: 1,
      offersThisWeek: 1,
    });
  });

  it("excludes transitions exactly 7 days old or older", () => {
    const jobs = [job({ appliedAt: at(-7) }), job({ appliedAt: at(-8) })];
    expect(computeWeekStats(jobs, NOW).appliedThisWeek).toBe(0);
  });

  it("excludes transitions dated in the future (clock skew)", () => {
    const jobs = [job({ appliedAt: at(1) })];
    expect(computeWeekStats(jobs, NOW).appliedThisWeek).toBe(0);
  });

  it("ignores jobs with no transition date for that stage", () => {
    const jobs = [job(), job()];
    expect(computeWeekStats(jobs, NOW)).toEqual({
      appliedThisWeek: 0,
      interviewsThisWeek: 0,
      offersThisWeek: 0,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(computeWeekStats([], NOW)).toEqual({
      appliedThisWeek: 0,
      interviewsThisWeek: 0,
      offersThisWeek: 0,
    });
  });
});

describe("formatWeekStatsRow", () => {
  it("formats counts, including zeros, as a single compact line", () => {
    expect(formatWeekStatsRow({ appliedThisWeek: 4, interviewsThisWeek: 2, offersThisWeek: 0 })).toBe(
      "Applied this week 4 · Interviews 2 · Offers 0",
    );
  });
});

describe("shouldShowWeekStats", () => {
  it("hides the row for fewer than 3 jobs", () => {
    expect(shouldShowWeekStats(0)).toBe(false);
    expect(shouldShowWeekStats(1)).toBe(false);
    expect(shouldShowWeekStats(2)).toBe(false);
  });

  it("shows the row at 3 or more jobs", () => {
    expect(shouldShowWeekStats(3)).toBe(true);
    expect(shouldShowWeekStats(10)).toBe(true);
  });
});
