import { describe, expect, it } from "vitest";
import { canonicalJobUrl, encodeJob, matchUrl, saveJobUrl, saveUrl } from "../src/links.js";
// The decoder /save runs: the two sides of the fragment format
import { decodeExtensionJob } from "../../shared/extensionJob.ts";

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

describe("saveJobUrl", () => {
  const job = {
    url: "https://theprotocol.it/szczegoly/praca/starszy-programista,oferta,0100",
    title: "Starszy Programista Full-stack (JavaScript + PHP) (K/M)",
    company: "ASTEK Polska",
    location: "Warszawa, mazowieckie",
    description: "Wymagania\n\n- JavaScript, Vue.js 3 & PHP\n- 100% zdalnie? #remote = tak 🚀",
  };

  it("puts the job in the fragment, never the query", async () => {
    const url = new URL(await saveJobUrl(job));
    expect(url.origin + url.pathname).toBe("https://openapply.app/save");
    expect([...url.searchParams.keys()]).toEqual(["utm_source", "utm_campaign", "utm_medium"]);
    expect(url.searchParams.get("utm_medium")).toBe("save");
    expect(url.hash).toMatch(/^#job=[A-Za-z0-9_-]+$/);
    expect(url.href).not.toContain("ASTEK");
  });

  it("round-trips through the /save decoder", async () => {
    const url = new URL(await saveJobUrl(job));
    await expect(decodeExtensionJob(url.hash)).resolves.toEqual(job);
  });

  it("keeps a very long description short enough for a URL", async () => {
    const words = Array.from({ length: 4000 }, (_, index) => `skill${index % 700}`).join(" ");
    const long = { ...job, description: `${words} ${"x".repeat(30000)}` };
    const url = await saveJobUrl(long);
    // Chrome allows 2 MB URLs; stay far below anything a proxy or log might cut
    expect(url.length).toBeLessThan(32000);
    const decoded = await decodeExtensionJob(new URL(url).hash);
    expect(decoded.description).toHaveLength(15000);
    expect(decoded.description).toBe(long.description.slice(0, 15000));
  });

  it("carries the posting dates", async () => {
    const posting = { postedAt: "2025-05-16", postedAtSource: "json-ld", reposted: true, validThrough: "2026-12-31" };
    const url = await saveJobUrl({ ...job, posting });
    await expect(decodeExtensionJob(new URL(url).hash)).resolves.toEqual({ ...job, posting });
  });

  it("carries the salary", async () => {
    const url = await saveJobUrl({ ...job, salary: "$120k-140k" });
    await expect(decodeExtensionJob(new URL(url).hash)).resolves.toEqual({ ...job, salary: "$120k-140k" });
  });

  it("trims and caps every field", async () => {
    const encoded = await encodeJob({ ...job, title: `  ${"T".repeat(500)}  `, company: undefined });
    const decoded = await decodeExtensionJob(`#job=${encoded}`);
    expect(decoded.title).toHaveLength(300);
    expect(decoded.company).toBe("");
  });
});

describe("decodeExtensionJob", () => {
  it.each([
    ["no fragment", ""],
    ["another fragment", "#jd=hello"],
    ["not base64url", "#job=abc$%"],
    ["not deflate", "#job=aGVsbG8gd29ybGQ"],
  ])("ignores %s", async (_, hash) => {
    await expect(decodeExtensionJob(hash)).resolves.toBeNull();
  });

  it("rejects a job without a web link or a description", async () => {
    const base = { url: "https://example.com/job", title: "T", company: "C", location: "", description: "D" };
    await expect(decodeExtensionJob(`#job=${await encodeJob({ ...base, url: "javascript:alert(1)" })}`)).resolves.toBeNull();
    await expect(decodeExtensionJob(`#job=${await encodeJob({ ...base, description: " " })}`)).resolves.toBeNull();
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
