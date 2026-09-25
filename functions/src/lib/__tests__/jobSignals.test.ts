import { describe, expect, it } from "vitest";
import {
  companyTitleKey,
  isOpenApplication,
  observeJob,
  publicSigns,
  sanitizePosting,
  type PrivateJobSignals,
} from "../jobSignals";

const now = Date.parse("2026-09-25T12:00:00Z");

describe("sanitizePosting", () => {
  it("keeps valid fields and drops the rest", () => {
    expect(
      sanitizePosting({ postedAt: "2025-05-16", postedAtSource: "json-ld", reposted: true, validThrough: "2026-12-31", x: 1 }, now),
    ).toEqual({ postedAt: "2025-05-16", postedAtSource: "json-ld", reposted: true, validThrough: "2026-12-31" });
    expect(sanitizePosting({ postedAt: "2026-10-30", postedAtSource: "page" }, now)).toBeUndefined();
    expect(sanitizePosting({ postedAt: "2026-02-30", postedAtSource: "page" }, now)).toBeUndefined();
    expect(sanitizePosting({ postedAt: "2026-09-01" }, now)).toBeUndefined();
    expect(sanitizePosting("2026-09-01", now)).toBeUndefined();
  });
});

describe("companyTitleKey", () => {
  it("normalizes case, punctuation, gender tags and legal suffixes", () => {
    expect(companyTitleKey("Workato, Inc.", "Senior Software Engineer, RoR")).toBe("workato|senior software engineer ror");
    expect(companyTitleKey("KUGU Home GmbH", "Backend Developer (m/w/d)")).toBe("kugu home|backend developer");
    expect(companyTitleKey("Acme", "Data Analyst (f/m/x)")).toBe(companyTitleKey("ACME", "data analyst"));
  });

  it("is empty without a company or a title", () => {
    expect(companyTitleKey("", "Engineer")).toBe("");
    expect(companyTitleKey("Unknown company", "Engineer")).toBe("");
    expect(companyTitleKey("Acme", "Unknown position")).toBe("");
  });
});

describe("isOpenApplication", () => {
  it.each([
    ["Open Application", true],
    ["Initiative application (m/f/d)", true],
    ["Initiativbewerbung", true],
    ["General Application - Engineering", true],
    ["Join our Talent Pool", true],
    ["Senior Full Stack Engineer", false],
    ["Application Engineer", false],
  ])("%s", (title, expected) => {
    expect(isOpenApplication(title)).toBe(expected);
  });
});

const base = { key: "greenhouse:1", company: "Acme", title: "Data Analyst" };

describe("observeJob", () => {
  it("records the first sighting", () => {
    expect(observeJob(undefined, { ...base, seenAt: now })).toEqual({
      key: "greenhouse:1",
      companyTitleKey: "acme|data analyst",
      firstSeenAt: "2026-09-25",
      lastSeenAt: "2026-09-25",
      listing: { lastListedAt: "2026-09-25" },
      listingCheckDueAt: "2026-10-02",
    });
  });

  it("keeps the first sighting, and the earliest and latest posted dates", () => {
    const first = observeJob(undefined, {
      ...base,
      seenAt: Date.parse("2026-01-03T00:00:00Z"),
      posting: { postedAt: "2026-01-02", postedAtSource: "json-ld" },
    });
    const later = observeJob(first, {
      ...base,
      seenAt: now,
      posting: { postedAt: "2026-08-27", postedAtSource: "json-ld", validThrough: "2026-10-27" },
    });
    expect(later).toEqual({
      key: "greenhouse:1",
      companyTitleKey: "acme|data analyst",
      firstSeenAt: "2026-01-03",
      lastSeenAt: "2026-09-25",
      earliestPostedAt: "2026-01-02",
      latestPostedAt: "2026-08-27",
      postedAtSource: "json-ld",
      validThrough: "2026-10-27",
      listing: { lastListedAt: "2026-09-25" },
      listingCheckDueAt: "2026-01-10",
    });
  });

  it("moves the first sighting earlier when an older application is recorded later", () => {
    const recent = observeJob(undefined, { ...base, seenAt: now });
    const older = observeJob(recent, { ...base, seenAt: Date.parse("2026-01-10T00:00:00Z") });
    expect(older).toMatchObject({ firstSeenAt: "2026-01-10", lastSeenAt: "2026-09-25" });
  });

  it("prefers a JSON-LD date over a page date, and keeps reposted and open application once seen", () => {
    const fromPage = observeJob(undefined, {
      ...base,
      title: "Open application",
      seenAt: now,
      posting: { postedAt: "2026-08-26", postedAtSource: "page", postedOrEarlier: true, reposted: true },
    });
    expect(fromPage).toMatchObject({ postedAtSource: "page", postedOrEarlier: true, repostedOnPage: true, openApplication: true });
    const withJsonLd = observeJob(fromPage, { ...base, seenAt: now, posting: { postedAt: "2026-08-20", postedAtSource: "json-ld" } });
    expect(withJsonLd).toMatchObject({ earliestPostedAt: "2026-08-20", latestPostedAt: "2026-08-20", postedAtSource: "json-ld", repostedOnPage: true, openApplication: true });
    expect(withJsonLd).not.toHaveProperty("postedOrEarlier");
  });

  it("ignores a page date once a JSON-LD date is known", () => {
    const withJsonLd = observeJob(undefined, { ...base, seenAt: now, posting: { postedAt: "2025-05-16", postedAtSource: "json-ld" } });
    const again = observeJob(withJsonLd, { ...base, seenAt: now, posting: { postedAt: "2026-09-20", postedAtSource: "page" } });
    expect(again).toMatchObject({ earliestPostedAt: "2025-05-16", latestPostedAt: "2025-05-16", postedAtSource: "json-ld" });
  });
});

const signals = (overrides: Partial<PrivateJobSignals>): PrivateJobSignals => ({
  key: "greenhouse:2",
  companyTitleKey: "workato|senior software engineer ror",
  firstSeenAt: "2026-06-01",
  lastSeenAt: "2026-06-01",
  ...overrides,
});

describe("publicSigns", () => {
  it("shows posted dates, a refreshed date, the page's repost and open application", () => {
    expect(
      publicSigns(
        signals({
          earliestPostedAt: "2026-01-02",
          latestPostedAt: "2026-08-27",
          postedAtSource: "json-ld",
          repostedOnPage: true,
          openApplication: true,
        }),
        [],
      ),
    ).toEqual({
      firstSeenAt: "2026-06-01",
      postedAt: "2026-01-02",
      postedAtSource: "json-ld",
      dateRefreshed: { from: "2026-01-02", to: "2026-08-27" },
      repostedOnPage: true,
      openApplication: true,
    });
  });

  it("doesn't call a date change under 7 days a refresh", () => {
    const signs = publicSigns(signals({ earliestPostedAt: "2026-08-20", latestPostedAt: "2026-08-25", postedAtSource: "json-ld" }), []);
    expect(signs).not.toHaveProperty("dateRefreshed");
  });

  it("marks the same role under an older ATS id as reposted", () => {
    const signs = publicSigns(signals({}), [
      { key: "greenhouse:1", firstSeenAt: "2026-01-10" },
      { key: "greenhouse:0", firstSeenAt: "2025-11-02" },
    ]);
    expect(signs.sameRoleReposted).toEqual({ count: 2, firstSeenAt: "2025-11-02" });
  });

  it("ignores the same role seen under 30 days apart, and link-only keys", () => {
    const signs = publicSigns(signals({}), [
      { key: "greenhouse:1", firstSeenAt: "2026-05-10" },
      { key: "url:https://acme.com/jobs/1", firstSeenAt: "2025-01-01" },
    ]);
    expect(signs).not.toHaveProperty("sameRoleReposted");
    expect(publicSigns(signals({ key: "url:https://acme.com/jobs/2" }), [{ key: "greenhouse:1", firstSeenAt: "2025-01-01" }]))
      .not.toHaveProperty("sameRoleReposted");
  });

  it("stays quiet for employers with several openings of the same title at once", () => {
    // Amazon posts one req per team: same title, new ids, same weeks
    const signs = publicSigns(signals({}), [
      { key: "greenhouse:1", firstSeenAt: "2026-01-10" },
      { key: "greenhouse:3", firstSeenAt: "2026-06-03" },
      { key: "greenhouse:4", firstSeenAt: "2026-05-28" },
    ]);
    expect(signs).not.toHaveProperty("sameRoleReposted");
  });
});
