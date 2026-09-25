import { describe, expect, it } from "vitest";
import { toMatchView, verdictFor } from "../matchView";
import type { ResumeJobMatch } from "@/types";

const result = (overrides: Partial<ResumeJobMatch["matchResult"]> = {}): ResumeJobMatch["matchResult"] => ({
  match_summary: { overall_match_percent: 82.4, summary: "Strong frontend fit." },
  recommendations: { improvement_areas: ["Add the Pinia store to the checkout bullet.", " "] },
  skills_comparison: {
    matched_skills: [
      { skill: "Vue 3", evidence: "Led the move to Vue 3", status: "matched" },
      { skill: "TypeScript", evidence: "TypeScript everywhere", status: "matched" },
    ],
    partially_matched_skills: [{ skill: "Pinia", evidence: "Listed in skills only", status: "matched" }],
    missing_skills: [{ skill: "GraphQL", status: "matched" }],
  },
  ...overrides,
});

describe("toMatchView", () => {
  it("lists met, then partly, then missing, with counts", () => {
    const view = toMatchView(result());
    expect(view.requirements.map((r) => [r.label, r.status])).toEqual([
      ["Vue 3", "met"],
      ["TypeScript", "met"],
      ["Pinia", "partly"],
      ["GraphQL", "missing"],
    ]);
    expect(view.counts).toEqual({ met: 2, partly: 1, missing: 1 });
    expect(view.countsLine).toBe("2 of 4 requirements met, 1 partly, 1 missing");
  });

  it("says a missing skill is not in the resume when there's no evidence", () => {
    expect(toMatchView(result()).requirements[3].evidence).toBe("Not in your resume");
  });

  it("rounds the score and drops empty fixes", () => {
    const view = toMatchView(result());
    expect(view.score).toBe(82);
    expect(view.verdict).toBe("Likely to pass the first screen");
    expect(view.fixes).toEqual(["Add the Pinia store to the checkout bullet."]);
  });

  it("copes with a result that has no skills", () => {
    const view = toMatchView(result({ skills_comparison: {}, recommendations: {} }));
    expect(view.requirements).toEqual([]);
    expect(view.countsLine).toBe("");
    expect(view.fixes).toEqual([]);
  });
});

describe("verdictFor", () => {
  it("is blunt about low scores", () => {
    expect(verdictFor(75)).toBe("Likely to pass the first screen");
    expect(verdictFor(60)).toBe("Could pass with a few fixes");
    expect(verdictFor(30)).toBe("Unlikely to pass as it is");
  });
});
