import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

const source = readFileSync(join(here, "../src/extract.js"), "utf8")
  .replace("export function extractJob", "function extractJob");

// Runs the extractor inside a page built from a saved fixture, the way
// chrome.scripting.executeScript runs it in the real tab
function extractFrom(fixture, { select, withoutJsonLd = false, withoutSiteRules = false, extractor = source, url: pageUrl } = {}) {
  let html = readFileSync(join(here, `fixtures/${fixture}.html`), "utf8");
  const code = withoutSiteRules ? extractor.replace("SITES.find(", "[].find(") : extractor;
  if (withoutJsonLd) html = html.replace(/<script[^>]*ld\+json[^>]*>[\s\S]*?<\/script>/g, "");
  const url = pageUrl ?? html.match(/Captured (\S+)/)[1];
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  if (select) {
    const range = dom.window.document.createRange();
    range.selectNodeContents(dom.window.document.querySelector(select));
    dom.window.getSelection().addRange(range);
  }
  return dom.window.eval(`${code}; extractJob()`);
}

describe("extractJob on captured job pages", () => {
  it.each([
    // fixture, title, company, source, text the description must contain, min chars
    ["greenhouse", "AI Engineer", "GitLab", "site", "GitLab is the intelligent orchestration platform", 8000],
    ["lever", "Android Engineer - Experience", "Spotify", "site", "We design Spotify’s consumer experience", 5000],
    ["ashby", "Security Engineer, Cloud", "Ramp", "site", "Ramp is building the smart infrastructure", 4000],
    ["workable", "Senior Open-Source Python Engineer, ML Developer Tools - EMEA Remote", "Hugging Face", "site", "At Hugging Face, we're on a journey", 2000],
    ["linkedin", "Senior Software Engineer, Frontend", "Circle", "site", "Circle (NYSE: CRCL)", 4000],
    ["airbnb", "Account Manager", "Airbnb", "page", "Airbnb was born in 2007", 5000],
    ["theprotocol", "Starszy Programista Full-stack (JavaScript + PHP) (K/M)", "ASTEK Polska", "site", "Rozwój i utrzymanie aplikacji webowych", 3000],
  ])("%s", (fixture, title, company, sourceKind, snippet, minChars) => {
    const job = extractFrom(fixture);
    expect(job.title).toBe(title);
    expect(job.company).toBe(company);
    expect(job.source).toBe(sourceKind);
    expect(job.description).toContain(snippet);
    expect(job.description.length).toBeGreaterThan(minChars);
  });

  it.each([
    ["greenhouse", "Remote, Bangalore"],
    ["lever", "London / Stockholm"],
    ["ashby", "New York City, NY, USA · Remote"],
    ["workable", "Remote"],
    ["linkedin", "Salt Lake City Metropolitan Area"],
    ["theprotocol", "Warszawa, mazowieckie"],
  ])("reads the location on %s", (fixture, location) => {
    expect(extractFrom(fixture).location).toBe(location);
  });

  it.each([
    ["workable", ["At Hugging Face, we're on a journey", "If you love open-source", "More about Hugging Face"]],
    ["workable-netguru", ["Netguru is a trusted partner", "Project Details:", "Requirements", "Must-have:", "3+ years of hands-on Snowflake experience", "Benefits", "100% remote work;"]],
  ])("reads the description, requirements and benefits of a Workable job (%s)", (fixture, snippets) => {
    const { title, company, description } = extractFrom(fixture);
    for (const snippet of snippets) expect(description).toContain(snippet);
    // In page order, one section after another
    expect(description.indexOf("Requirements")).toBeGreaterThan(description.indexOf("Description"));
    expect(description.indexOf("Benefits")).toBeGreaterThan(description.indexOf("Requirements"));
    if (fixture === "workable-netguru") {
      expect(title).toBe("(Senior) Data Engineer with AI - Freelance");
      expect(company).toBe("Netguru");
    }
  });

  // Any job page, not just the boards we have rules for: every real capture read
  // with no site rules and no JSON-LD
  it.each([
    ["greenhouse", "GitLab is the intelligent orchestration platform", 8000],
    ["lever", "We design Spotify’s consumer experience", 5000],
    ["ashby", "Ramp is building the smart infrastructure", 4000],
    ["workable", "More about Hugging Face", 5000],
    ["workable-netguru", "3+ years of hands-on Snowflake experience", 2500],
    ["linkedin", "Circle (NYSE: CRCL)", 4000],
    ["airbnb", "Airbnb was born in 2007", 5000],
    ["theprotocol", "Rozwój i utrzymanie aplikacji webowych", 3000],
  ])("reads the whole job on %s from the page alone", (fixture, snippet, minChars) => {
    const job = extractFrom(fixture, { withoutSiteRules: true, withoutJsonLd: true });
    expect(job.source).toBe("page");
    expect(job.description).toContain(snippet);
    expect(job.description.length).toBeGreaterThan(minChars);
  });

  it("ignores lists of job links when finding the description", () => {
    // LinkedIn's public page has "Regions Bank jobs", "Medpace jobs" link lists
    const { description } = extractFrom("linkedin", { withoutSiteRules: true, withoutJsonLd: true });
    expect(description).not.toContain("Regions Bank jobs");
  });

  it("adds the sections a site rule misses from the page", () => {
    // Workable's rule as it was: the description section only, no requirements or benefits
    const extractor = source.replace(/\{ all: '\[data-ui="job-description"\][^}]*\},/, `'[data-ui="job-description"]',`);
    expect(extractor).not.toBe(source);
    const { description, source: sourceKind } = extractFrom("workable-netguru", { extractor });
    expect(sourceKind).toBe("page");
    expect(description).toContain("Netguru is a trusted partner");
    expect(description).toContain("3+ years of hands-on Snowflake experience");
    expect(description).toContain("100% remote work;");
  });

  it("keeps a site rule's text when the page adds a job list before it", () => {
    const { description, source: sourceKind } = extractFrom("linkedin-signed-in-synthetic");
    expect(sourceKind).toBe("site");
    expect(description).not.toContain("Other job card");
  });

  it("reads LinkedIn's 2026 job page, which has no h1 and hashed class names", () => {
    const job = extractFrom("linkedin-2026");
    expect(job.title).toBe("Engineering Manager");
    expect(job.company).toBe("EduGO Prosta Spółka Akcyjna");
    expect(job.location).toBe("Łódź, Łódzkie, Poland");
    expect(job.description).toContain("Jesteśmy jedną z najszybciej rozwijających się szkół online");
    expect(job.description).toContain("Minimum 6–7 lat w inżynierii oprogramowania");
    expect(job.description).toContain("Etap 4: Rozmowa finalna z Zarządem.");
    // The rest of the page: top card, upsells, hiring team, company card, more jobs
    for (const noise of ["18 people clicked apply", "Retry Premium", "Dariusz Lis", "822 followers", "Storyblok", "See more jobs like this"]) {
      expect(job.description).not.toContain(noise);
    }
  });

  it("reads every section of a theprotocol.it offer, not just the first", () => {
    const { description } = extractFrom("theprotocol");
    for (const heading of ["Nasze wymagania", "O projekcie", "To oferujemy", "Założona w 1988 roku"]) {
      expect(description).toContain(heading);
    }
    // Recommended offers and the "ask a question" box aren't the job
    expect(description).not.toContain("Mid PHP Developer");
    expect(description).not.toContain("Brakuje Ci informacji");
  });

  it("reads a single-page app it has no rules for", () => {
    // theprotocol.it's rendered page on an unknown host, without its JSON-LD
    const job = extractFrom("theprotocol", { withoutJsonLd: true, url: "https://careers.example.com/offer/1" });
    expect(job).toMatchObject({
      title: "Starszy Programista Full-stack (JavaScript + PHP) (K/M)",
      company: "ASTEK Polska",
      location: "Warszawa, mazowieckie",
      source: "page",
    });
    for (const section of ["Nasze wymagania", "O projekcie", "To oferujemy"]) {
      expect(job.description).toContain(section);
    }
    expect(job.description).not.toContain("Mid PHP Developer");
  });

  it("keeps site navigation and footers out of a generic career page", () => {
    const job = extractFrom("airbnb");
    expect(job.description).not.toContain("Life at Airbnb");
    expect(job.description).not.toContain("Cookie Preferences");
  });

  it("keeps paragraphs and bullets on separate lines", () => {
    const job = extractFrom("linkedin-signed-in-synthetic");
    expect(job.description).toContain("About the job\n");
    expect(job.description).toContain("- Ship product features\n- Mentor engineers");
  });
});

describe("extractJob on layouts that can't be captured headless", () => {
  it("reads the signed-in LinkedIn job panel, not the job list", () => {
    const job = extractFrom("linkedin-signed-in-synthetic");
    expect(job).toMatchObject({ title: "Senior Software Engineer, Frontend", company: "Circle", source: "site" });
    expect(job.description).not.toContain("Other job card");
  });

  it("reads Indeed without its screen-reader suffix", () => {
    const job = extractFrom("indeed-synthetic");
    expect(job).toMatchObject({ title: "Frontend Engineer", company: "Acme Robotics", source: "site" });
    expect(job.description).toContain("About the role");
  });

  it("reads title, company and location from the page's own markup", () => {
    const dom = new JSDOM(
      `<title>Platform Engineer at Initech | Initech Careers</title>
      <header><h1>Initech</h1><span class="location">Head office</span></header>
      <main>
        <h1>Platform Engineer</h1>
        <div class="job-location">Location: Austin, TX</div>
        <p>${"Run the platform. ".repeat(20)}</p>
      </main>`,
      { url: "https://initech.example/jobs/9", runScripts: "outside-only" },
    );
    const job = dom.window.eval(`${source}; extractJob()`);
    expect(job).toMatchObject({ title: "Platform Engineer", company: "Initech", location: "Austin, TX" });
  });

  it("falls back to schema.org JobPosting", () => {
    const job = extractFrom("jsonld-synthetic");
    expect(job).toMatchObject({ title: "Data Analyst", company: "Example Corp", source: "json-ld" });
    expect(job.description).toContain("- SQL\n- dbt");
  });
});

describe("extractJob salary", () => {
  // baseSalary is arbitrary JSON-LD: build a page around it and read job.salary
  function salaryOf(baseSalary) {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "X", baseSalary })}</script><main><p>Short.</p></main>`;
    const dom = new JSDOM(html, { url: "https://careers.example.com/jobs/1", runScripts: "outside-only" });
    return dom.window.eval(`${source}; extractJob()`).salary;
  }

  it("reads a salary range from JSON-LD baseSalary", () => {
    expect(extractFrom("jsonld-synthetic").salary).toBe("$120,000–$140,000/yr");
  });

  it("reads a single salary value with a non-USD currency", () => {
    const baseSalary = { "@type": "MonetaryAmount", currency: "EUR", value: { "@type": "QuantitativeValue", value: 60000, unitText: "YEAR" } };
    expect(salaryOf(baseSalary)).toBe("€60,000/yr");
  });

  it("has no salary when the page's JSON-LD doesn't list one", () => {
    expect(extractFrom("greenhouse").salary).toBe("");
  });

  it("reads amounts given as numeric strings", () => {
    const baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: { "@type": "QuantitativeValue", minValue: "120,000", maxValue: "140000", unitText: "YEAR" },
    };
    expect(salaryOf(baseSalary)).toBe("$120,000–$140,000/yr");
  });

  it.each([
    ["competitive"],
    ["120k"],
    [null],
  ])("skips a garbage or non-numeric amount (%s) instead of saving NaN", (value) => {
    const baseSalary = { "@type": "MonetaryAmount", currency: "USD", value: { "@type": "QuantitativeValue", value, unitText: "YEAR" } };
    const salary = salaryOf(baseSalary);
    expect(salary).toBe("");
    expect(salary).not.toContain("NaN");
  });
});

describe("extractJob with a text selection", () => {
  it("prefers the text the user selected", () => {
    const job = extractFrom("greenhouse", { select: ".job__description" });
    expect(job.source).toBe("selection");
    expect(job.description).toContain("GitLab is the intelligent orchestration platform");
  });

  it("ignores a selection too short to be a job description", () => {
    const job = extractFrom("greenhouse", { select: "h1" });
    expect(job.source).toBe("site");
  });
});

describe("extractJob limits", () => {
  it("caps the description at the tool's 15,000 characters", () => {
    const dom = new JSDOM(
      `<main><p>${"requirement ".repeat(3000)}</p></main>`,
      { url: "https://careers.example.com/jobs/1", runScripts: "outside-only" },
    );
    const job = dom.window.eval(`${source}; extractJob()`);
    expect(job.description).toHaveLength(15000);
  });

  it("finds no description on a page without one", () => {
    const dom = new JSDOM(
      "<title>Example</title><main><p>Short page.</p></main>",
      { url: "https://example.com/", runScripts: "outside-only" },
    );
    const job = dom.window.eval(`${source}; extractJob()`);
    expect(job).toMatchObject({ title: "Example", description: "", source: "none" });
  });
});

// Posting dates feed the ghost-job signals: only this job's own date, never
// one from a "similar jobs" list on the same page
describe("extractJob posting dates", () => {
  const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  it.each([
    ["ashby", "2026-04-07", undefined],
    ["lever", "2026-06-23", undefined],
    ["workable", "2026-09-21", undefined],
    ["workable-netguru", "2026-09-16", undefined],
    ["theprotocol", "2026-09-16", "2026-10-16"],
    ["linkedin", "2026-09-22", "2026-10-31"],
  ])("%s: datePosted from JSON-LD", (fixture, postedAt, validThrough) => {
    const expected = { postedAt, postedAtSource: "json-ld" };
    if (validThrough) expected.validThrough = validThrough;
    expect(extractFrom(fixture).posting).toEqual(expected);
  });

  it("reads validThrough from JSON-LD", () => {
    expect(extractFrom("jsonld-synthetic").posting).toEqual({
      postedAt: "2025-05-16",
      postedAtSource: "json-ld",
      validThrough: "2026-12-31",
    });
  });

  it("has no date when the page shows none", () => {
    expect(extractFrom("greenhouse").posting).toEqual({});
    expect(extractFrom("linkedin-signed-in-synthetic").posting).toEqual({});
  });

  it("LinkedIn without JSON-LD: the top card's own age", () => {
    expect(extractFrom("linkedin", { withoutJsonLd: true }).posting).toEqual({
      postedAt: daysAgo(1),
      postedAtSource: "page",
    });
  });

  it("LinkedIn: a reposted job, not the similar jobs' ages", () => {
    expect(extractFrom("linkedin-reposted-synthetic").posting).toEqual({
      postedAt: daysAgo(14),
      postedAtSource: "page",
      reposted: true,
    });
  });

  it("Workday: 30+ days is an upper bound on the date", () => {
    expect(extractFrom("workday-synthetic").posting).toEqual({
      postedAt: daysAgo(30),
      postedAtSource: "page",
      postedOrEarlier: true,
    });
  });

  it("ignores an unparseable or future JSON-LD date", () => {
    const page = (date) => new JSDOM(
      `<script type="application/ld+json">{"@type":"JobPosting","title":"X","datePosted":"${date}"}</script><main><p>Short.</p></main>`,
      { url: "https://careers.example.com/jobs/1", runScripts: "outside-only" },
    ).window.eval(`${source}; extractJob()`);
    expect(page("next week").posting).toEqual({});
    expect(page("2999-01-01").posting).toEqual({});
  });
});
