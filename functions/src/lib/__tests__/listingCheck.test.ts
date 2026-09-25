import { describe, expect, it } from "vitest";
import { applyListingCheck, listingRequest, listingState } from "../listingCheck";
import { observeJob, publicSigns, type PrivateJobSignals } from "../jobSignals";

describe("listingRequest", () => {
  it.each([
    ["https://job-boards.greenhouse.io/workato/jobs/8181689002", "greenhouse:8181689002",
      { kind: "greenhouse-api", url: "https://boards-api.greenhouse.io/v1/boards/workato/jobs/8181689002" }],
    ["https://job-boards.eu.greenhouse.io/parloa/jobs/4889900101", "greenhouse:4889900101",
      { kind: "greenhouse-api", url: "https://boards-api.greenhouse.io/v1/boards/parloa/jobs/4889900101" }],
    ["https://jobs.lever.co/capital/9726b1f7-d360-4f21-889f-d71acd0b039c", "lever:9726b1f7-d360-4f21-889f-d71acd0b039c",
      { kind: "lever-api", url: "https://api.lever.co/v0/postings/capital/9726b1f7-d360-4f21-889f-d71acd0b039c" }],
    ["https://jobs.eu.lever.co/acme/9726b1f7-d360-4f21-889f-d71acd0b039c", "lever:9726b1f7-d360-4f21-889f-d71acd0b039c",
      { kind: "lever-api", url: "https://api.eu.lever.co/v0/postings/acme/9726b1f7-d360-4f21-889f-d71acd0b039c" }],
    ["https://jobs.ashbyhq.com/Tremendous/35855f4f-ac80-4d78-ae33-a572ed9e3a52", "ashby:35855f4f-ac80-4d78-ae33-a572ed9e3a52",
      { kind: "ashby-api", url: "https://api.ashbyhq.com/posting-api/job-board/Tremendous", id: "35855f4f-ac80-4d78-ae33-a572ed9e3a52" }],
    ["https://werkenbij.q42.nl/techlead/nl", "url:https://werkenbij.q42.nl/techlead/nl",
      { kind: "page", url: "https://werkenbij.q42.nl/techlead/nl" }],
  ])("%s", (link, key, expected) => {
    expect(listingRequest(link, key)).toEqual(expected);
  });

  it("skips what it can't check reliably: LinkedIn, Indeed, Workday shells, embeds without a board", () => {
    expect(listingRequest("https://www.linkedin.com/jobs/view/1/", "linkedin:1")).toBeNull();
    expect(listingRequest("https://www.indeed.com/viewjob?jk=abc", "indeed:abc")).toBeNull();
    expect(listingRequest("https://iko.wd3.myworkdayjobs.com/IKO/job/X_REQ-1", "workday:iko:REQ-1")).toBeNull();
    expect(listingRequest("https://auterion.com/careers/?gh_jid=8391045002", "greenhouse:8391045002")).toBeNull();
    expect(listingRequest("", "greenhouse:1")).toBeNull();
  });
});

describe("listingState", () => {
  const lever = { kind: "lever-api", url: "x" } as const;
  const ashby = { kind: "ashby-api", url: "x", id: "35855f4f-ac80-4d78-ae33-a572ed9e3a52" } as const;
  const page = { kind: "page", url: "x" } as const;

  it("reads ATS APIs as listed or closed", () => {
    expect(listingState(lever, 200, "{}", "")).toBe("listed");
    expect(listingState(lever, 404, "", "")).toBe("closed");
    expect(listingState(ashby, 200, '{"jobs":[{"id":"35855f4f-ac80-4d78-ae33-a572ed9e3a52"}]}', "")).toBe("listed");
    expect(listingState(ashby, 200, '{"jobs":[]}', "")).toBe("closed");
    expect(listingState(lever, 500, "", "")).toBe("unknown");
  });

  it("counts a page as listed only when it shows the job title", () => {
    expect(listingState(page, 200, "<h1>Techlead / Principal Engineer</h1>", "techlead principal engineer")).toBe("listed");
    // A client-rendered shell: 200 but nothing to read
    expect(listingState(page, 200, "<div id=app></div>", "techlead principal engineer")).toBe("unknown");
    expect(listingState(page, 404, "", "techlead")).toBe("closed");
    expect(listingState(page, 410, "", "techlead")).toBe("closed");
    expect(listingState(page, 200, "<h1>Engineer</h1>", "")).toBe("unknown");
  });

  // Pages found in the cache that keep the title after the job closes
  it("a page that says the job is archived, filled or expired is closed", () => {
    const title = "ruby tech lead";
    expect(listingState(page, 200, "<h1>Ruby Tech Lead</h1><p>Вакансия в архиве</p>", title, { today: "2026-09-25" })).toBe("closed");
    expect(listingState(page, 200, "<h1>Ruby Tech Lead</h1><p>No longer accepting applications</p>", title, { today: "2026-09-25" })).toBe("closed");
    expect(listingState(page, 200, "<h1>Ruby Tech Lead</h1><p>Diese Stelle ist nicht mehr verfügbar</p>", title, { today: "2026-09-25" })).toBe("closed");
    expect(listingState(
      page, 200,
      '<script type="application/ld+json">{"@type":"JobPosting","validThrough":"2025-12-01T20:20:33+00:00"}</script><h1>Ruby Tech Lead</h1>',
      title, { today: "2026-09-25" },
    )).toBe("closed");
    expect(listingState(
      page, 200,
      '<script type="application/ld+json">{"@type":"JobPosting","validThrough":"2026-12-01"}</script><h1>Ruby Tech Lead</h1>',
      title, { today: "2026-09-25" },
    )).toBe("listed");
  });

  it("only the visible body counts, not the <head>", () => {
    // A client-rendered shell whose <title> names the job
    expect(listingState(page, 200, "<html><head><title>Senior Ruby Developer</title></head><body><div id=app></div></body></html>", "senior ruby developer"))
      .toBe("unknown");
  });

  it("a page that redirects somewhere else is unknown", () => {
    // join.com sent a closed posting to the same role under a new id
    const body = "<h1>Project Management Internship</h1>";
    const title = "project management internship";
    expect(listingState({ kind: "page", url: "https://join.com/companies/yami/16361440-project" }, 200, body, title, {
      finalUrl: "https://join.com/companies/yami/16728952-project",
    })).toBe("unknown");
    expect(listingState({ kind: "page", url: "https://join.com/companies/yami/16361440-project" }, 200, body, title, {
      finalUrl: "https://join.com/companies/yami/16361440-project?pid=abc",
    })).toBe("listed");
  });

  it("a careers index page isn't a job that can be listed", () => {
    expect(listingState(page, 200, "<h1>Current job openings</h1>", "current job openings")).toBe("unknown");
    expect(listingState(page, 200, "<h1>Careers</h1>", "careers")).toBe("unknown");
  });
});

const signals = (overrides: Partial<PrivateJobSignals> = {}): PrivateJobSignals => ({
  key: "lever:9726b1f7-d360-4f21-889f-d71acd0b039c",
  companyTitleKey: "capital|angular software engineer",
  firstSeenAt: "2026-01-10",
  lastSeenAt: "2026-01-10",
  link: "https://jobs.lever.co/capital/9726b1f7-d360-4f21-889f-d71acd0b039c",
  listingCheckDueAt: "2026-01-17",
  ...overrides,
});

describe("applyListingCheck", () => {
  it("listed: records the day and checks again in a week", () => {
    expect(applyListingCheck(signals(), "listed", "2026-09-25")).toMatchObject({
      listing: { lastCheckedAt: "2026-09-25", lastListedAt: "2026-09-25" },
      listingCheckDueAt: "2026-10-02",
    });
  });

  it("closed: records the day and stops checking", () => {
    const next = applyListingCheck(signals({ listing: { lastCheckedAt: "2026-09-18", lastListedAt: "2026-09-18" } }), "closed", "2026-09-25");
    expect(next.listing).toEqual({ lastCheckedAt: "2026-09-25", lastListedAt: "2026-09-18", closedAt: "2026-09-25" });
    expect(next).not.toHaveProperty("listingCheckDueAt");
  });

  it("unknown: tries again next week, gives up after 4 in a row", () => {
    let next = signals();
    for (let week = 1; week <= 3; week++) next = applyListingCheck(next, "unknown", `2026-09-0${week}`);
    expect(next.listing?.unknownStreak).toBe(3);
    expect(next).toHaveProperty("listingCheckDueAt");
    next = applyListingCheck(next, "unknown", "2026-09-04");
    expect(next).not.toHaveProperty("listingCheckDueAt");
    expect(applyListingCheck(next, "listed", "2026-09-05").listing).not.toHaveProperty("unknownStreak");
  });
});

describe("still listed", () => {
  const base = { key: "lever:9726b1f7-d360-4f21-889f-d71acd0b039c", company: "Capital", title: "Angular Software Engineer" };

  it("a save is a sighting: it sets the link, a check a week out, and the last listed day", () => {
    const first = observeJob(undefined, { ...base, link: "https://jobs.lever.co/capital/9726b1f7-d360-4f21-889f-d71acd0b039c", seenAt: Date.parse("2026-01-10T00:00:00Z") });
    expect(first).toMatchObject({ link: "https://jobs.lever.co/capital/9726b1f7-d360-4f21-889f-d71acd0b039c", listingCheckDueAt: "2026-01-17", listing: { lastListedAt: "2026-01-10" } });
  });

  it("a new save of a closed job reopens it", () => {
    const closed = signals({ listing: { lastCheckedAt: "2026-05-01", lastListedAt: "2026-04-01", closedAt: "2026-05-01" } });
    delete closed.listingCheckDueAt;
    const reopened = observeJob(closed, { ...base, seenAt: Date.parse("2026-09-20T00:00:00Z") });
    expect(reopened.listing).toEqual({ lastCheckedAt: "2026-05-01", lastListedAt: "2026-09-20" });
    expect(reopened.listingCheckDueAt).toBe("2026-09-27");
  });

  it("shows still listed after 60+ days, not before, and not once closed", () => {
    expect(publicSigns(signals({ listing: { lastCheckedAt: "2026-09-25", lastListedAt: "2026-09-25" } }), []).stillListed)
      .toEqual({ since: "2026-01-10", lastListedAt: "2026-09-25" });
    expect(publicSigns(signals({ listing: { lastCheckedAt: "2026-02-20", lastListedAt: "2026-02-20" } }), []))
      .not.toHaveProperty("stillListed");
    expect(publicSigns(signals({ listing: { lastCheckedAt: "2026-09-25", lastListedAt: "2026-08-01", closedAt: "2026-09-25" } }), []))
      .not.toHaveProperty("stillListed");
  });
});
