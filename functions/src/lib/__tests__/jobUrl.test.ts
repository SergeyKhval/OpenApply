import { describe, expect, it } from "vitest";
import { canonicalJobUrl } from "../jobUrl";

describe("canonicalJobUrl", () => {
  it.each([
    // Source tags can carry referral credit, so they stay
    ["https://job-boards.greenhouse.io/workato/jobs/8181689002?gh_src=zp8esh8k2us&utm_source=x", "https://job-boards.greenhouse.io/workato/jobs/8181689002?gh_src=zp8esh8k2us"],
    ["https://example.com/job?utm_source=x&utm_medium=y&id=7", "https://example.com/job?id=7"],
    ["https://example.com/job?gclid=1&fbclid=2", "https://example.com/job"],
    // Plain anchors are the same page; hash routes are not
    ["https://zoolatech.com/vacancies/qa-216414-1.html#block-id-forms-join-our-team", "https://zoolatech.com/vacancies/qa-216414-1.html"],
    ["https://careers.example.com/#/jobs/123", "https://careers.example.com/#/jobs/123"],
    // Search pages that show one job resolve to the posting
    ["https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=ruby", "https://www.linkedin.com/jobs/view/4012345678/"],
    ["https://www.linkedin.com/jobs/view/senior-dev-at-acme-4012345678?trk=abc", "https://www.linkedin.com/jobs/view/4012345678/"],
    ["https://de.indeed.com/jobs?q=dev&vjk=abc123def", "https://de.indeed.com/viewjob?jk=abc123def"],
    // Job ids in the query stay
    ["https://acme.com/careers?gh_jid=4567", "https://acme.com/careers?gh_jid=4567"],
  ])("%s", (input, expected) => {
    expect(canonicalJobUrl(input)).toBe(expected);
  });

  it("returns null for non-http URLs", () => {
    expect(canonicalJobUrl("ftp://example.com/job")).toBeNull();
    expect(canonicalJobUrl("not a url")).toBeNull();
  });
});
