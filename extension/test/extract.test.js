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
function extractFrom(fixture, { select, withoutJsonLd = false, url: pageUrl } = {}) {
  let html = readFileSync(join(here, `fixtures/${fixture}.html`), "utf8");
  if (withoutJsonLd) html = html.replace(/<script[^>]*ld\+json[^>]*>[\s\S]*?<\/script>/g, "");
  const url = pageUrl ?? html.match(/Captured (\S+)/)[1];
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  if (select) {
    const range = dom.window.document.createRange();
    range.selectNodeContents(dom.window.document.querySelector(select));
    dom.window.getSelection().addRange(range);
  }
  return dom.window.eval(`${source}; extractJob()`);
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
