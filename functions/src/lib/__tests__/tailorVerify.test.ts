import { describe, expect, it } from "vitest";
import { segmentResume } from "../tailorSegment";
import {
  assembleTailoredResume,
  canonicalize,
  factTokens,
  newFacts,
  tailorStats,
  verifyTailorOps,
  type TailorOp,
} from "../tailorVerify";
import { ANALYSIS, RESUME } from "./tailorFixtures";

const lines = segmentResume(RESUME);
const idOf = (start: string) => lines.find((line) => line.text.startsWith(start))!.id;
const vocabulary = { terms: [...ANALYSIS.technologies, ...ANALYSIS.missingKeywords] };
const context = { lines, vocabulary, requirementCount: ANALYSIS.requirements.length };

const op = (partial: Partial<TailorOp> & Pick<TailorOp, "kind" | "lineIds">): TailorOp => ({
  text: "",
  term: "",
  requirement: 0,
  reason: "",
  ...partial,
});
const verifyOne = (candidate: TailorOp) => verifyTailorOps([candidate], context)[0];
const rephrase = (start: string, text: string, requirement = 0) =>
  verifyOne(op({ kind: "rephrase", lineIds: [idOf(start)], text, requirement }));

describe("canonicalize", () => {
  it("maps aliases to one spelling", () => {
    expect(canonicalize("Postgres and Node and k8s")).toBe("postgresql and node.js and kubernetes");
    expect(canonicalize("ReactJS, Amazon Web Services")).toBe("react, aws");
  });

  it("doesn't alias inside other words", () => {
    expect(canonicalize("JSON and tsconfig")).toBe("json and tsconfig");
  });
});

describe("factTokens", () => {
  it("finds numbers, units and multipliers", () => {
    const facts = factTokens("Cut costs by $1.2M (40%) for 3x growth, 5+ years, 1,000 users", { terms: [] });
    for (const fact of ["num:1.2", "unit:usd", "mult:m", "num:40", "unit:%", "mult:x", "unit:+", "num:1000"]) {
      expect(facts).toContain(fact);
    }
  });

  it("reads spelled numbers as numbers", () => {
    const facts = factTokens("Mentored two interns and doubled throughput", { terms: [] });
    expect(facts).toContain("num:2");
    expect(facts).toContain("mult:x2");
  });
});

describe("newFacts", () => {
  const source = "Helped with the migration of legacy screens to Redux in 3 years.";

  it("accepts a reorder of the same facts", () => {
    expect(newFacts("Moved legacy screens to Redux over 3 years, helping with the migration.", source, vocabulary)).toEqual(
      ["lex:over"],
    );
    expect(newFacts("Migrated legacy screens to Redux, helping for 3 years.", source, vocabulary)).toEqual([]);
  });

  it("accepts a lowercase source word written capitalized", () => {
    expect(newFacts("Redux migration of legacy screens.", "migrated legacy screens to redux", vocabulary)).toEqual([]);
  });
});

describe("verifyTailorOps: edits that must revert", () => {
  it.each([
    ["adds a number", "Raised", "Raised test coverage from 40% to 95% with Jest.", ["num:95"]],
    ["adds a percentage", "Built the core", "Built the core web app in React with TypeScript, 30% faster.", ["num:30"]],
    ["derives a total", "Helped with", "Helped with the migration of legacy screens to Redux, 5+ years.", ["num:5"]],
    ["adds a missing job keyword", "Built the core", "Built the core web app in React with TypeScript on Kubernetes.", ["term:kubernetes"]],
    ["adds a tool", "Integrated REST", "Integrated REST and gRPC APIs for billing and search, handling errors.", ["word:grpc"]],
    ["adds an employer", "Organized", "Organized the team's weekly demo for Google.", ["word:google"]],
    ["escalates helped to led", "Helped with", "Led the migration of legacy screens off ad-hoc state to Redux.", ["lex:lead"]],
    ["escalates to owned", "Organized", "Owned the team's weekly demo.", ["lex:own"]],
    ["inflates scope", "Built the core", "Built the entire web app in React with TypeScript across the codebase.", ["lex:entire"]],
    ["adds seniority", "Organized", "Organized the senior team's weekly demo.", ["lex:senior"]],
    ["adds a qualifier", "Raised", "Raised test coverage by more than 40% to 85% with Jest.", ["lex:over"]],
    ["starts with an invented tool", "Maintained Postgres", "Kafka and Postgres queries for the reporting dashboard.", ["word:kafka"]],
    ["adds a language", "Organized", "Organized the team's weekly demo in German.", ["word:german"]],
    ["adds a degree", "Mentored two", "Mentored two interns on code review during my master's.", ["lex:degree"]],
    ["spells out a new number", "Mentored two", "Mentored five interns on code review.", ["num:5"]],
    ["adds a multiplier", "Raised", "Raised test coverage from 40% to 85% with Jest, doubling it.", ["mult:x2"]],
  ])("%s", (_label, start, text, offending) => {
    const result = rephrase(start, text);
    expect(result.status).toBe("reverted");
    expect(result.revertReason).toBe("new_fact");
    expect(result.offendingTokens).toEqual(expect.arrayContaining(offending));
  });

  it("refuses to edit a locked job header", () => {
    expect(rephrase("Frontend Engineer, Northwind", "Senior Frontend Engineer, Northwind Software").revertReason).toBe(
      "locked_line",
    );
    expect(verifyOne(op({ kind: "cut", lineIds: [idOf("Junior Developer")] })).revertReason).toBe("locked_line");
  });

  it("refuses to edit dates, contact or education", () => {
    for (const start of ["Mar 2019", "sarah.chen@", "B.S. Computer"]) {
      expect(rephrase(start, "anything").revertReason).toBe("locked_line");
    }
  });

  it("refuses to merge bullets from two jobs", () => {
    const result = verifyOne(
      op({ kind: "rephrase", lineIds: [idOf("Built the core"), idOf("Maintained Postgres")], text: "Built the core web app in React and maintained Postgres queries." }),
    );
    expect(result.revertReason).toBe("owner_mismatch");
  });

  it("refuses an unknown or forged line id", () => {
    expect(verifyOne(op({ kind: "moveUp", lineIds: ["L999"] })).revertReason).toBe("unknown_line");
    expect(verifyOne(op({ kind: "moveUp", lineIds: [] })).revertReason).toBe("unknown_line");
  });

  it("refuses an edit without a real requirement", () => {
    expect(verifyOne(op({ kind: "moveUp", lineIds: [idOf("Raised")], requirement: -1 })).revertReason).toBe("no_requirement");
    expect(verifyOne(op({ kind: "moveUp", lineIds: [idOf("Raised")], requirement: 99 })).revertReason).toBe("no_requirement");
  });

  it("refuses padding", () => {
    const padded = "Organized the team's weekly demo, which was a demo that the team organized weekly, every week.";
    expect(rephrase("Organized", padded).revertReason).toBe("too_long");
  });

  it("refuses a rephrase that changes nothing", () => {
    expect(rephrase("Organized", "Organized the team's weekly demo.").revertReason).toBe("no_change");
  });

  it("refuses to surface a keyword the line doesn't state", () => {
    const result = verifyOne(op({ kind: "surfaceKeyword", lineIds: [idOf("Built the core")], term: "Kubernetes" }));
    expect(result.revertReason).toBe("term_not_in_source");
  });

  it("refuses to surface a keyword already under Skills", () => {
    const result = verifyOne(op({ kind: "surfaceKeyword", lineIds: [idOf("Built the core")], term: "React" }));
    expect(result.revertReason).toBe("term_already_listed");
  });

  it("lets the first edit of a line win", () => {
    const [first, second] = verifyTailorOps(
      [
        op({ kind: "cut", lineIds: [idOf("Organized")], requirement: -1 }),
        op({ kind: "rephrase", lineIds: [idOf("Organized")], text: "Ran the team's weekly demo." }),
      ],
      context,
    );
    expect(first.status).toBe("applied");
    expect(second.revertReason).toBe("conflict");
  });
});

// The six inflated rewrites the precision gate's run 1 let through
// (research/tailored-resume-gate-2026-09.md), as they came from the model
describe("verifyTailorOps: gate run 1 inflations", () => {
  const gateContext = (resume: string, requirementTexts: string[] = []) => {
    const gateLines = segmentResume(resume);
    return { lines: gateLines, vocabulary: { terms: [], requirementTexts }, requirementCount: 1 };
  };
  const rewrite = (resume: string, text: string, requirementTexts: string[] = []) => {
    const context = gateContext(resume, requirementTexts);
    const line = context.lines.filter((candidate) => candidate.role === "bullet").at(-1)!;
    return verifyTailorOps([op({ kind: "rephrase", lineIds: [line.id], text })], context)[0];
  };
  const job = (bullet: string) => `Name\nExperience\nRole, Company\n2020 – 2024\n• ${bullet}`;

  it.each([
    [
      "drops 'informally' and 'a handful'",
      "Talked informally with a handful of patients after launch to gather reactions to the new portal.",
      "Gathered patient feedback post-launch to evaluate reactions to the new portal.",
      ["qual:informal", "qual:few"],
    ],
    [
      "drops 'no production use yet'",
      "Started learning Python through an online course; no production use yet.",
      "Started learning Python through an online course.",
      ["qual:not-shipped"],
    ],
    [
      "drops 'started' and 'no production use yet'",
      "Started learning Python through an online course; no production use yet.",
      "Learning Python through an online course.",
      ["qual:not-shipped"],
    ],
  ])("%s", (_label, source, text, dropped) => {
    const result = rewrite(job(source), text);
    expect(result.revertReason).toBe("dropped_qualifier");
    expect(result.offendingTokens).toEqual(expect.arrayContaining(dropped));
  });

  it("adds 'busy'", () => {
    const result = rewrite(
      job("Provided direct patient care for a 6-8 patient med-surg assignment each shift."),
      "Provided direct patient care for a busy 6-8 patient med-surg assignment each shift.",
    );
    expect(result).toMatchObject({ revertReason: "new_fact", offendingTokens: ["lex:busy"] });
  });

  it("borrows the job's wording the cited line doesn't state", () => {
    const result = rewrite(
      job("Took part in the on-call rotation and wrote runbooks for common incidents."),
      "Took part in the on-call rotation for customer-facing services and wrote runbooks.",
      ["On-call experience for customer-facing services"],
    );
    expect(result).toMatchObject({ revertReason: "job_word", offendingTokens: ["job:customer-facing", "job:services"] });
  });

  it.each([
    ["high-volume", "Handled customer complaints at a retail store.", "Handled customer complaints at a high-volume retail store."],
    ["fast paced", "Shipped features for the checkout team.", "Shipped features for the fast paced checkout team."],
    ["complex", "Built reporting queries in SQL.", "Built complex reporting queries in SQL."],
    ["successfully", "Migrated the billing service to Go.", "Successfully migrated the billing service to Go."],
  ])("adds an intensifier: %s", (_label, source, text) => {
    expect(rewrite(job(source), text).revertReason).toBe("new_fact");
  });
});

// The inflations gate run 2 let through, as they came from the model
describe("verifyTailorOps: gate run 2 inflations", () => {
  const job = (bullet: string) => `Name\nExperience\nRole, Company\n2020 – 2024\n• ${bullet}`;
  const context = (resume: string) => ({ lines: segmentResume(resume), vocabulary: { terms: [] }, requirementCount: 1 });
  const rewrite = (source: string, text: string) =>
    verifyTailorOps([op({ kind: "rephrase", lineIds: ["L5"], text })], context(job(source)))[0];

  it.each([
    [
      "drops a count",
      "Managed two freelance writers and a $5,000/month content budget.",
      "Managed freelance writers and a $5,000/month content budget.",
      "scope_change",
      ["dropped-num:2"],
    ],
    [
      "turns a singular noun plural",
      "Managed the regional marketing budget for France and Belgium.",
      "Managed regional marketing budgets for France and Belgium.",
      "scope_change",
      ["plural:budgets"],
    ],
    [
      "drops 'approximately once a week'",
      "Served as relief charge nurse on night shift approximately once a week, coordinating assignments and admissions.",
      "Served as relief charge nurse on night shift, coordinating assignments and admissions.",
      "dropped_qualifier",
      ["qual:approximate", "qual:frequency"],
    ],
    [
      "adds 'strong'",
      "Prepared financial statements in accordance with GAAP for quarterly board reporting.",
      "Demonstrated strong GAAP knowledge by preparing financial statements for quarterly board reporting.",
      "new_fact",
      ["lex:strong"],
    ],
  ])("%s", (_label, source, text, reason, tokens) => {
    const result = rewrite(source, text);
    expect(result.revertReason).toBe(reason);
    expect(result.offendingTokens).toEqual(expect.arrayContaining(tokens));
  });

  it("won't list a skill from a line that says the candidate is only learning it", () => {
    const result = verifyTailorOps(
      [op({ kind: "surfaceKeyword", lineIds: ["L5"], term: "Python" })],
      context(job("Started learning Python through an online course; no production use yet.")),
    )[0];
    expect(result).toMatchObject({ revertReason: "qualified_source" });
    expect(result.offendingTokens).toEqual(expect.arrayContaining(["qual:learning", "qual:not-shipped"]));
  });

  it("still lists a skill from a line whose qualifier isn't about skill level", () => {
    const result = verifyTailorOps(
      [op({ kind: "surfaceKeyword", lineIds: ["L5"], term: "Redux" })],
      context(job("Owned global state with Redux, migrating several legacy screens off ad-hoc component state.")),
    )[0];
    expect(result.status).toBe("applied");
  });

  it("won't list overlapping terms twice", () => {
    const [first, second] = verifyTailorOps(
      [
        op({ kind: "surfaceKeyword", lineIds: ["L5"], term: "REST" }),
        op({ kind: "surfaceKeyword", lineIds: ["L5"], term: "REST APIs" }),
      ],
      context(job("Integrated REST APIs for authentication and payments.")),
    );
    expect(first.status).toBe("applied");
    expect(second.revertReason).toBe("term_already_listed");
  });
});

// The inflations gate run 3 (fresh pairs) let through
describe("verifyTailorOps: gate run 3 inflations", () => {
  const job = (bullet: string) => `Name\nExperience\nRole, Company\n2020 – 2024\n• ${bullet}`;
  const context = (resume: string) => ({ lines: segmentResume(resume), vocabulary: { terms: [] }, requirementCount: 1 });
  const surface = (bullet: string, term: string) =>
    verifyTailorOps([op({ kind: "surfaceKeyword", lineIds: ["L5"], term })], context(job(bullet)))[0];
  const rewrite = (bullet: string, text: string) =>
    verifyTailorOps([op({ kind: "rephrase", lineIds: ["L5"], text })], context(job(bullet)))[0];

  it("won't list a skill from a line where the candidate only sat in", () => {
    const result = surface("Sat in on model evaluation reviews with the ML team.", "ML");
    expect(result).toMatchObject({ revertReason: "qualified_source", offendingTokens: ["qual:observe"] });
  });

  it.each([
    ["the ML team", "Wrote the release notes for the ML team.", "ML"],
    ["another team's name with a word between", "Handed data to the Salesforce admin team every week.", "Salesforce"],
    ["people", "Booked travel for the Kubernetes engineers.", "Kubernetes"],
  ])("won't list a skill that names others' work: %s", (_label, bullet, term) => {
    expect(surface(bullet, term).revertReason).toBe("others_work");
  });

  it("still lists a skill the line also names as the candidate's own", () => {
    expect(surface("Built Spark jobs and reviewed PRs for the Spark team.", "Spark").status).toBe("applied");
    expect(surface("Wrote Airflow DAGs for the nightly batch pipelines.", "Airflow").status).toBe("applied");
  });

  it("keeps 'shadowed', 'observed' and 'sat in on' through a rewrite", () => {
    expect(rewrite("Shadowed scrub techs in general and orthopedic cases.", "Worked with scrub techs in general and orthopedic cases.")).toMatchObject({
      revertReason: "dropped_qualifier",
      offendingTokens: ["qual:observe"],
    });
    expect(rewrite("Sat in on model evaluation reviews with the ML team.", "Attended model evaluation reviews with the ML team.").status).toBe("applied");
  });

  it("won't drop the modifier that says which one", () => {
    expect(rewrite("Built the invoice API in Go.", "Built the API in Go.")).toMatchObject({
      revertReason: "dropped_specifier",
      offendingTokens: ["specifier:invoice api"],
    });
    expect(rewrite("Built the invoice API in Go.", "Developed the invoicing API in Go.").revertReason).not.toBe("dropped_specifier");
    expect(rewrite("Built the invoice API in Go.", "Built the invoice API with Go.").status).toBe("applied");
  });
});

describe("verifyTailorOps: qualifiers and job words that are fine", () => {
  const context = (resume: string, requirementTexts: string[] = []) => ({
    lines: segmentResume(resume),
    vocabulary: { terms: [], requirementTexts },
    requirementCount: 1,
  });
  const job = (bullet: string) => `Name\nExperience\nRole, Company\n2020 – 2024\n• ${bullet}`;
  const rewrite = (source: string, text: string, requirementTexts: string[] = []) =>
    verifyTailorOps([op({ kind: "rephrase", lineIds: ["L5"], text })], context(job(source), requirementTexts))[0];

  it("keeps a qualifier through a synonym of the same family", () => {
    expect(rewrite("Helped the team migrate billing to Stripe.", "Supported the team's billing migration to Stripe.").status).toBe("applied");
  });

  it("allows a job word whose stem the line states", () => {
    const result = rewrite("Built churn prediction models in Python with scikit-learn.", "Built predictive models for churn in Python with scikit-learn.", [
      "2+ years building predictive models in Python",
    ]);
    expect(result.status).toBe("applied");
  });

  it("ignores generic requirement words", () => {
    const result = rewrite("Wrote Terraform modules for VPCs and load balancers.", "Wrote Terraform modules for VPCs and load balancers, with strong experience.", [
      "Strong experience with Terraform",
    ]);
    expect(result.revertReason).not.toBe("job_word");
  });
});

describe("verifyTailorOps: edits that apply", () => {
  it("allows an alias to the job's spelling", () => {
    const result = rephrase("Maintained Postgres", "Maintained PostgreSQL queries for the reporting dashboard.", 3);
    expect(result.status).toBe("applied");
  });

  it("allows leading with the result", () => {
    expect(rephrase("Raised", "Took test coverage from 40% to 85% with Jest.").status).toBe("applied");
  });

  it("allows merging two bullets from the same job", () => {
    const result = verifyOne(
      op({
        kind: "rephrase",
        lineIds: [idOf("Built the core"), idOf("Integrated REST")],
        text: "Built the core React and TypeScript web app and integrated REST APIs for billing and search.",
      }),
    );
    expect(result.status).toBe("applied");
  });

  it("surfaces a keyword the resume states", () => {
    const result = verifyOne(op({ kind: "surfaceKeyword", lineIds: [idOf("Maintained Postgres")], term: "PostgreSQL", requirement: 3 }));
    expect(result).toMatchObject({ status: "applied", term: "PostgreSQL" });
  });

  it("allows a cut without a requirement", () => {
    expect(verifyOne(op({ kind: "cut", lineIds: [idOf("Organized")], requirement: -1 })).status).toBe("applied");
  });
});

describe("assembleTailoredResume", () => {
  const ops = verifyTailorOps(
    [
      op({ kind: "moveUp", lineIds: [idOf("Integrated REST")], requirement: 1 }),
      op({ kind: "rephrase", lineIds: [idOf("Maintained Postgres")], text: "Maintained PostgreSQL queries for the reporting dashboard.", requirement: 3 }),
      op({ kind: "cut", lineIds: [idOf("Organized")], requirement: -1 }),
      op({ kind: "surfaceKeyword", lineIds: [idOf("Maintained Postgres")], term: "PostgreSQL", requirement: 3 }),
      op({ kind: "rephrase", lineIds: [idOf("Helped with")], text: "Led the Redux migration." }),
    ],
    context,
  );
  const headingIds = lines.filter((line) => line.role === "heading").map((line) => line.id);
  // Summary, Skills, Experience, Education
  const skillsFirst = [headingIds[0], headingIds[2], headingIds[1], headingIds[3]];
  const doc = assembleTailoredResume(lines, ops, skillsFirst);
  const texts = (heading: string | null) => doc.sections.find((section) => section.heading === heading)!.lines.map((line) => line.text);

  it("keeps the top block first and follows the section order", () => {
    expect(doc.sections.map((section) => section.heading)).toEqual([null, "Summary", "Skills", "Experience", "Education"]);
    expect(texts(null)).toEqual(["Sarah Chen", "sarah.chen@example.com · Portland, OR"]);
  });

  it("moves a bullet to the top of its own job only", () => {
    const experience = texts("Experience");
    expect(experience.slice(0, 3)).toEqual([
      "Frontend Engineer, Northwind Software",
      "Mar 2019 – Present",
      "Integrated REST APIs for billing and search, handling pagination and error states.",
    ]);
    expect(experience.indexOf("Junior Developer, Acme Corp")).toBeGreaterThan(experience.indexOf("Built the core web app in React with TypeScript across the codebase."));
  });

  it("applies rephrases and cuts, and keeps reverted lines as the original", () => {
    const experience = texts("Experience");
    expect(experience).toContain("Maintained PostgreSQL queries for the reporting dashboard.");
    expect(experience).not.toContain("Organized the team's weekly demo.");
    expect(experience).toContain("Helped with the migration of legacy screens off ad-hoc state to Redux.");
  });

  it("adds surfaced terms to Skills", () => {
    expect(texts("Skills")).toEqual(["React, TypeScript, Redux, Jest", "PostgreSQL"]);
  });

  it("drops edits the user switched off", () => {
    const withoutCut = assembleTailoredResume(lines, ops, skillsFirst, new Set([2]));
    expect(withoutCut.sections.find((section) => section.heading === "Experience")!.lines.map((line) => line.text)).toContain(
      "Organized the team's weekly demo.",
    );
  });

  it("falls back to source order for a bad section order", () => {
    const fallback = assembleTailoredResume(lines, ops, ["L999"]);
    expect(fallback.sections.map((section) => section.heading)).toEqual([null, "Summary", "Experience", "Skills", "Education"]);
  });

  it("creates a Skills section after the summary when there is none", () => {
    const noSkills = segmentResume("Name\nSummary\nEngineer.\nExperience\nDev, Co\n2020 – 2022\n• Wrote Go services.");
    const surfaced = verifyTailorOps(
      [op({ kind: "surfaceKeyword", lineIds: ["L7"], term: "Go" })],
      { lines: noSkills, vocabulary, requirementCount: 1 },
    );
    const result = assembleTailoredResume(noSkills, surfaced, []);
    expect(result.sections.map((section) => section.heading)).toEqual([null, "Summary", "Skills", "Experience"]);
  });

  it("counts stats by revert reason", () => {
    expect(tailorStats(ops)).toEqual({ proposed: 5, applied: 4, reverted: 1, byReason: { new_fact: 1 } });
  });
});
