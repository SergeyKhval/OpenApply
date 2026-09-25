import { describe, expect, it } from "vitest";
import type { JobApplication, JobStatus } from "@/types";
import { buildNextUp, type NextUpInterview } from "../nextUp";

const NOW = new Date(2026, 8, 25, 10, 0); // Fri 25 Sep 2026, 10:00 local
const at = (dayOffset: number, hour = 9) => new Date(2026, 8, 25 + dayOffset, hour, 0);
const ts = (date: Date) => ({ toDate: () => date }) as unknown as JobApplication["createdAt"];

const job = (id: string, status: JobStatus, extra: Partial<Record<"createdAt" | "followUpAt", Date | null>> = {}) =>
  ({
    id,
    companyName: `Company ${id}`,
    position: "Engineer",
    status,
    createdAt: ts(extra.createdAt ?? at(-1)),
    followUpAt: extra.followUpAt === undefined ? undefined : extra.followUpAt && ts(extra.followUpAt),
  }) as unknown as JobApplication;

const interview = (applicationId: string, when: Date, status = "pending"): NextUpInterview => ({
  id: `i-${applicationId}`,
  applicationId,
  name: "Tech screen",
  conductedAt: when,
  status,
});

describe("buildNextUp", () => {
  it("lists follow-ups due today or overdue, most overdue first", () => {
    const items = buildNextUp(
      [
        job("a", "applied", { followUpAt: at(0) }),
        job("b", "applied", { followUpAt: at(-3) }),
        job("c", "applied", { followUpAt: at(2) }),
      ],
      [],
      NOW,
    );
    expect(items.map((item) => [item.kind, item.job.id])).toEqual([
      ["follow-up", "b"],
      ["follow-up", "a"],
    ]);
    expect(items[0]).toMatchObject({ overdueDays: 3 });
    expect(items[1]).toMatchObject({ overdueDays: 0 });
  });

  it("skips follow-ups on closed jobs and cleared follow-ups", () => {
    const items = buildNextUp(
      [job("a", "rejected", { followUpAt: at(-1) }), job("b", "applied", { followUpAt: null })],
      [],
      NOW,
    );
    expect(items).toEqual([]);
  });

  it("lists pending interviews in the next 7 days, soonest first", () => {
    const jobs = [job("a", "interviewing"), job("b", "interviewing"), job("c", "interviewing")];
    const items = buildNextUp(
      jobs,
      [
        interview("a", at(3)),
        interview("b", at(0, 15)),
        interview("c", at(9)),
        interview("a", at(1), "passed"),
      ],
      NOW,
    );
    expect(items.map((item) => [item.kind, item.job.id])).toEqual([
      ["interview", "b"],
      ["interview", "a"],
    ]);
  });

  it("ignores interviews whose job is gone or closed", () => {
    const items = buildNextUp([job("a", "rejected")], [interview("a", at(1)), interview("zzz", at(1))], NOW);
    expect(items).toEqual([]);
  });

  it("nudges saved jobs older than 5 days", () => {
    const items = buildNextUp(
      [job("old", "draft", { createdAt: at(-6) }), job("new", "draft", { createdAt: at(-2) })],
      [],
      NOW,
    );
    expect(items).toEqual([expect.objectContaining({ kind: "stale-saved", savedDaysAgo: 6 })]);
    expect(items[0].job.id).toBe("old");
  });

  it("orders follow-ups, then interviews, then stale saved jobs, capped", () => {
    const jobs = [
      job("f", "applied", { followUpAt: at(-1) }),
      job("i", "interviewing"),
      job("s", "draft", { createdAt: at(-10) }),
    ];
    const items = buildNextUp(jobs, [interview("i", at(2))], NOW);
    expect(items.map((item) => item.kind)).toEqual(["follow-up", "interview", "stale-saved"]);
    expect(buildNextUp(jobs, [interview("i", at(2))], NOW, 2)).toHaveLength(2);
  });

  it("handles jobs without timestamps (still being written)", () => {
    const pending = { ...job("p", "draft"), createdAt: null } as unknown as JobApplication;
    expect(buildNextUp([pending], [], NOW)).toEqual([]);
  });
});
