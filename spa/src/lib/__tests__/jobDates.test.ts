import { describe, expect, it } from "vitest";
import type { JobApplication, JobStatus } from "@/types";
import { daysAgoLabel, followUpLabel, stageSinceLabel, toJsDate } from "../jobDates";

const NOW = new Date(2026, 8, 25, 10, 0); // Fri 25 Sep 2026
const day = (offset: number) => new Date(2026, 8, 25 + offset, 9, 0);
const ts = (date: Date) => ({ toDate: () => date });

const job = (status: JobStatus, fields: Record<string, unknown> = {}) =>
  ({ id: "j", status, createdAt: ts(day(-10)), ...fields }) as unknown as JobApplication;

describe("toJsDate", () => {
  it("reads Firestore timestamps, dates and calendar dates", () => {
    expect(toJsDate(ts(day(0)))).toEqual(day(0));
    expect(toJsDate(day(1))).toEqual(day(1));
    expect(toJsDate({ toDate: (timezone: string) => (timezone ? day(2) : null) })).toEqual(day(2));
    expect(toJsDate(null)).toBeNull();
    expect(toJsDate(undefined)).toBeNull();
  });
});

describe("daysAgoLabel", () => {
  it("speaks plainly", () => {
    expect(daysAgoLabel(day(0), NOW)).toBe("today");
    expect(daysAgoLabel(day(-1), NOW)).toBe("yesterday");
    expect(daysAgoLabel(day(-8), NOW)).toBe("8 days ago");
  });
});

describe("stageSinceLabel", () => {
  it("uses the date the job entered its stage", () => {
    expect(stageSinceLabel(job("draft", { createdAt: ts(day(-6)) }), NOW)).toBe("Saved 6 days ago");
    expect(stageSinceLabel(job("applied", { appliedAt: ts(day(-8)) }), NOW)).toBe("Applied 8 days ago");
    expect(stageSinceLabel(job("interviewing", { interviewedAt: day(-1) }), NOW)).toBe("Interviewing since yesterday");
    expect(stageSinceLabel(job("interviewing", { interviewedAt: day(-3) }), NOW)).toBe("Interviewing for 3 days");
    expect(stageSinceLabel(job("interviewing", { interviewedAt: day(0) }), NOW)).toBe("Interviewing since today");
    expect(stageSinceLabel(job("offered", { offeredAt: ts(day(0)) }), NOW)).toBe("Offer today");
  });

  it("falls back to the last update, then to creation", () => {
    expect(stageSinceLabel(job("applied", { updatedAt: ts(day(-3)) }), NOW)).toBe("Applied 3 days ago");
    expect(stageSinceLabel(job("applied"), NOW)).toBe("Applied 10 days ago");
  });

  it("names the reason for closed jobs", () => {
    expect(stageSinceLabel(job("rejected", { updatedAt: ts(day(-2)) }), NOW)).toBe("Rejected 2 days ago");
  });
});

describe("followUpLabel", () => {
  it("flags due and overdue follow-ups", () => {
    expect(followUpLabel(job("applied", { followUpAt: ts(day(0)) }), NOW)).toEqual({ text: "Follow up today", due: true });
    expect(followUpLabel(job("applied", { followUpAt: ts(day(-2)) }), NOW)).toEqual({ text: "Follow up today", due: true });
  });

  it("names the weekday this week, the date after that", () => {
    expect(followUpLabel(job("applied", { followUpAt: ts(day(3)) }), NOW)).toEqual({ text: "Follow up Mon", due: false });
    expect(followUpLabel(job("applied", { followUpAt: ts(day(17)) }), NOW)).toEqual({ text: "Follow up 12 Oct", due: false });
  });

  it("is empty when there is no follow-up or the job is closed", () => {
    expect(followUpLabel(job("applied", { followUpAt: null }), NOW)).toBeNull();
    expect(followUpLabel(job("rejected", { followUpAt: ts(day(0)) }), NOW)).toBeNull();
  });
});
