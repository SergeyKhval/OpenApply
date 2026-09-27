import { describe, expect, it } from "vitest";
import { mustHaveLine, toMatchView, verdictFor } from "../matchView";
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

  it("uses the singular for a single requirement", () => {
    const view = toMatchView(
      result({ skills_comparison: { matched_skills: [{ skill: "Vue 3", evidence: "Vue 3", status: "matched" }], partially_matched_skills: [], missing_skills: [] } }),
    );
    expect(view.countsLine).toBe("1 of 1 requirement met");
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

describe("mustHaveLine", () => {
  const requirement = (name: string, status: string, importance = "must-have") => ({
    requirement: name,
    status,
    importance,
  });

  it("counts must-haves and names what's missing, as on the canvas", () => {
    const line = mustHaveLine([
      requirement("Vue 3", "matched"),
      requirement("TypeScript", "matched"),
      requirement("Design systems", "matched"),
      requirement("Testing", "matched"),
      requirement("Accessibility", "partial"),
      requirement("GraphQL", "missing"),
      requirement("Storybook", "missing", "nice-to-have"),
    ]);
    expect(line).toBe("4 of 6 must-haves met, 1 partly, missing GraphQL");
  });

  it("names two missing, counts three or more", () => {
    expect(mustHaveLine([requirement("A", "missing"), requirement("B", "missing")])).toBe(
      "0 of 2 must-haves met, missing A and B",
    );
    expect(
      mustHaveLine([requirement("A", "missing"), requirement("B", "missing"), requirement("C", "missing")]),
    ).toBe("0 of 3 must-haves met, 3 missing");
  });

  it("is empty when nothing is marked must-have", () => {
    expect(mustHaveLine([requirement("A", "matched", "nice-to-have")])).toBe("");
  });
});
