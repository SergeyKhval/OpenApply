import { describe, expect, it } from "vitest";
import { canonicalJobUrl, matchUrl, saveUrl } from "../src/links.js";

describe("canonicalJobUrl", () => {
  it.each([
    ["https://www.linkedin.com/jobs/search/?currentJobId=4459277902&keywords=frontend", "https://www.linkedin.com/jobs/view/4459277902/"],
    ["https://www.linkedin.com/jobs/collections/recommended/?currentJobId=123", "https://www.linkedin.com/jobs/view/123/"],
    ["https://www.linkedin.com/jobs/view/senior-software-engineer-frontend-at-circle-4459277902?trk=public_jobs", "https://www.linkedin.com/jobs/view/4459277902/"],
    ["https://uk.linkedin.com/jobs/view/4459277902/?refId=abc&trackingId=xyz", "https://www.linkedin.com/jobs/view/4459277902/"],
    ["https://www.indeed.com/jobs?q=frontend&l=Remote&vjk=a1b2c3d4e5f60718", "https://www.indeed.com/viewjob?jk=a1b2c3d4e5f60718"],
    ["https://uk.indeed.com/viewjob?jk=a1b2c3d4e5f60718&from=serp&tk=1", "https://uk.indeed.com/viewjob?jk=a1b2c3d4e5f60718"],
    ["https://job-boards.greenhouse.io/gitlab/jobs/8556658002?gh_src=abc&utm_source=x", "https://job-boards.greenhouse.io/gitlab/jobs/8556658002?gh_src=abc"],
    ["https://careers.airbnb.com/positions/8184174?gh_jid=8184174#apply", "https://careers.airbnb.com/positions/8184174?gh_jid=8184174"],
    ["https://jobs.example.com/#/jobs/123", "https://jobs.example.com/#/jobs/123"],
  ])("%s", (input, expected) => {
    expect(canonicalJobUrl(input)).toBe(expected);
  });

  it.each(["chrome://extensions/", "chrome-extension://abc/popup.html", "file:///tmp/job.html", "not a url"])(
    "rejects %s",
    (input) => {
      expect(canonicalJobUrl(input)).toBeNull();
    },
  );
});

describe("saveUrl", () => {
  it("hands the posting to /save with extension UTMs", () => {
    const url = new URL(saveUrl("https://jobs.lever.co/spotify/abc?x=1&y=2"));
    expect(url.origin + url.pathname).toBe("https://openapply.app/save");
    expect(url.searchParams.get("url")).toBe("https://jobs.lever.co/spotify/abc?x=1&y=2");
    expect(url.searchParams.get("utm_source")).toBe("extension");
    expect(url.searchParams.get("utm_medium")).toBe("save");
    expect(url.searchParams.get("utm_campaign")).toBe("sprint-2609");
  });
});

describe("matchUrl", () => {
  it("puts the job description in the fragment, never the query", () => {
    const description = "Senior engineer & mentor. 100% remote #hiring\nMust know C++ = yes";
    const url = new URL(matchUrl({ description, url: "https://jobs.lever.co/spotify/abc" }));
    expect(url.origin + url.pathname).toBe("https://openapply.app/tools/resume-job-match");
    expect(url.search).not.toContain("jd=");
    expect(url.searchParams.get("utm_medium")).toBe("match");

    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(fragment.get("jd")).toBe(description);
    expect(fragment.get("url")).toBe("https://jobs.lever.co/spotify/abc");
  });
});
