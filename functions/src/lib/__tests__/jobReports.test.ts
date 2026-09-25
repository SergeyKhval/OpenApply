import { describe, expect, it } from "vitest";
import {
  isReportReason,
  limitBlock,
  noReplyFor30Days,
  publicReports,
  reportBlock,
  type ReportedApplication,
  type Reporter,
} from "../jobReports";

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 26, 12);
const reporter: Reporter = { emailVerified: true, anonymous: false, createdAt: NOW - 30 * DAY };
const application: ReportedApplication = {
  userId: "u1",
  status: "applied",
  jobKeyHash: "abc",
  appliedAt: NOW - 31 * DAY,
  createdAt: NOW - 40 * DAY,
};

describe("isReportReason", () => {
  it("accepts only the fixed reasons", () => {
    expect(isReportReason("asked_for_money")).toBe(true);
    expect(isReportReason("scam")).toBe(false);
    expect(isReportReason(undefined)).toBe(false);
  });
});

describe("reportBlock", () => {
  it("lets a verified week-old account report a job it saved", () => {
    expect(reportBlock("u1", reporter, application, "filled_still_listed", NOW)).toBeNull();
  });

  it("blocks anonymous, unverified and new accounts", () => {
    expect(reportBlock("u1", { ...reporter, anonymous: true }, application, "asked_for_money", NOW)).toBe("not_signed_in");
    expect(reportBlock("u1", { ...reporter, emailVerified: false }, application, "asked_for_money", NOW)).toBe(
      "email_not_verified",
    );
    expect(reportBlock("u1", { ...reporter, createdAt: NOW - 6 * DAY }, application, "asked_for_money", NOW)).toBe(
      "account_age",
    );
  });

  it("needs the job saved by the reporter, with a job key", () => {
    expect(reportBlock("u1", reporter, null, "asked_for_money", NOW)).toBe("not_saved");
    expect(reportBlock("u2", reporter, application, "asked_for_money", NOW)).toBe("not_saved");
    expect(reportBlock("u1", reporter, { ...application, jobKeyHash: undefined }, "asked_for_money", NOW)).toBe(
      "not_saved",
    );
  });

  it("only offers no reply after 30+ days in applied", () => {
    expect(reportBlock("u1", reporter, application, "no_reply_30d", NOW)).toBeNull();
    expect(reportBlock("u1", reporter, { ...application, appliedAt: NOW - 29 * DAY }, "no_reply_30d", NOW)).toBe(
      "not_eligible_no_reply",
    );
    expect(reportBlock("u1", reporter, { ...application, status: "interviewing" }, "no_reply_30d", NOW)).toBe(
      "not_eligible_no_reply",
    );
  });

  it("falls back to the save date when there's no applied date", () => {
    expect(noReplyFor30Days({ status: "applied", createdAt: NOW - 30 * DAY }, NOW)).toBe(true);
  });
});

describe("limitBlock", () => {
  const report = (daysAgo: number, company = "acme") => ({ createdAt: NOW - daysAgo * DAY + 1000, company });

  it("caps 5 a day and 20 a week", () => {
    const today = (count: number) => Array.from({ length: count }, (_, index) => report(0, `c${index}`));
    expect(limitBlock(today(4), "x", NOW)).toBeNull();
    expect(limitBlock(today(5), "x", NOW)).toBe("rate_limit");
    const week = Array.from({ length: 20 }, (_, index) => report(1 + (index % 5), `c${index}`));
    expect(limitBlock(week, "x", NOW)).toBe("rate_limit");
  });

  it("caps 3 reports on one company in 30 days", () => {
    expect(limitBlock([report(2), report(10), report(29)], "acme", NOW)).toBe("company_limit");
    expect(limitBlock([report(2), report(10), report(31)], "acme", NOW)).toBeNull();
    expect(limitBlock([report(2), report(10), report(20)], "other", NOW)).toBeNull();
  });
});

describe("publicReports", () => {
  const active = (reason: "no_reply_30d" | "asked_for_money", reportedOn: string) => ({
    reason,
    status: "active" as const,
    reportedOn,
  });

  it("publishes a reason only at 3 active reports within 180 days", () => {
    expect(
      publicReports(
        [
          active("no_reply_30d", "2026-09-12"),
          active("no_reply_30d", "2026-06-01"),
          active("no_reply_30d", "2026-08-02"),
          active("asked_for_money", "2026-09-01"),
          active("asked_for_money", "2026-09-02"),
        ],
        NOW,
      ),
    ).toEqual({ no_reply_30d: { days: ["2026-06-01", "2026-08-02", "2026-09-12"] } });
  });

  it("drops withdrawn, removed and old reports", () => {
    expect(
      publicReports(
        [
          active("asked_for_money", "2026-09-01"),
          active("asked_for_money", "2026-03-01"),
          { reason: "asked_for_money", status: "withdrawn", reportedOn: "2026-09-02" },
          { reason: "asked_for_money", status: "removed", reportedOn: "2026-09-03" },
        ],
        NOW,
      ),
    ).toEqual({});
  });
});
