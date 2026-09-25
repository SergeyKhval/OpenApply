import { describe, expect, it } from "vitest";
import { signLines, spanLabel, type JobSignalsDoc } from "../jobSignals";

const NOW = new Date(2026, 8, 25, 10);

const every: JobSignalsDoc = {
  signs: {
    firstSeenAt: "2026-01-10",
    postedAt: "2025-07-27",
    postedAtSource: "json-ld",
    dateRefreshed: { from: "2025-07-27", to: "2026-08-27" },
    sameRoleReposted: { count: 1, firstSeenAt: "2026-06-02" },
    stillListed: { since: "2026-01-10", lastListedAt: "2026-09-20" },
    openApplication: true,
  },
};

describe("signLines", () => {
  it("words every passed sign as a dated fact with its source", () => {
    expect(signLines(every, "Workato", NOW)).toEqual([
      {
        type: "still_listed",
        text: "Still listed 8 months after it was first saved on OpenApply (Jan 2026)",
        source: "Saves and OpenApply's weekly check, last seen listed Sep 20",
      },
      {
        type: "posted",
        text: "First posted 14 months ago (Jul 27, 2025)",
        source: "The posting's own date (schema.org datePosted)",
      },
      {
        type: "date_refreshed",
        text: "Posted date moved from Jul 27, 2025 to Aug 27, 2026",
        source: "The posting's own date, read on two different days",
      },
      {
        type: "same_role",
        text: "Same title at Workato saved under 1 older job ID, first in Jun 2026",
        source: "Jobs saved on OpenApply",
      },
      { type: "open_application", text: "Open application, not a specific opening", source: "The job title" },
    ]);
  });

  it("never calls a posting ghost, scam, fake or likely anything", () => {
    const text = signLines(every, "Workato", NOW)
      .flatMap((line) => [line.text, line.source])
      .join(" ");
    expect(text).not.toMatch(/ghost|scam|fake|likely|fraud|suspicious/i);
  });

  it("hides dates read off the page text and the page's own Reposted label", () => {
    const doc: JobSignalsDoc = {
      signs: { firstSeenAt: "2026-09-01", postedAt: "2025-01-01", postedAtSource: "page", repostedOnPage: true },
    };
    expect(signLines(doc, "Acme", NOW)).toEqual([]);
  });

  it("shows no posted date under 60 days old", () => {
    const doc: JobSignalsDoc = { signs: { firstSeenAt: "2026-09-01", postedAt: "2026-07-28", postedAtSource: "json-ld" } };
    expect(signLines(doc, "Acme", NOW)).toEqual([]);
    doc.signs!.postedAt = "2026-07-27";
    expect(signLines(doc, "Acme", NOW).map((line) => line.type)).toEqual(["posted"]);
  });

  it("shows nothing for a job the admin hid, or with no doc", () => {
    expect(signLines({ ...every, hidden: true }, "Workato", NOW)).toEqual([]);
    expect(signLines(null, "Workato", NOW)).toEqual([]);
    expect(signLines({}, "Workato", NOW)).toEqual([]);
  });

  it("counts several older job IDs and skips bad dates", () => {
    const doc: JobSignalsDoc = {
      signs: {
        firstSeenAt: "2026-09-01",
        sameRoleReposted: { count: 2, firstSeenAt: "2026-03-05" },
        dateRefreshed: { from: "not a day", to: "2026-08-27" },
      },
    };
    expect(signLines(doc, " ", NOW)).toEqual([
      {
        type: "same_role",
        text: "Same title at this company saved under 2 older job IDs, first in Mar 2026",
        source: "Jobs saved on OpenApply",
      },
    ]);
  });
});

describe("spanLabel", () => {
  it("counts months, then years from two years on", () => {
    expect(spanLabel(60)).toBe("2 months");
    expect(spanLabel(425)).toBe("14 months");
    expect(spanLabel(731)).toBe("2 years");
  });
});
