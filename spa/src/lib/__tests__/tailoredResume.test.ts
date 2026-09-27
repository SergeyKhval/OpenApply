import { describe, expect, it } from "vitest";
import {
  assembleTailoredResume,
  docText,
  explainRevert,
  newestTailoredPerJob,
  toChangeRows,
  type SourceLine,
  type TailoredDoc,
  type VerifiedOp,
} from "../tailoredResume";
import fixture from "../../../../shared/tailoredResumeCases.json";

const cases = fixture.cases as unknown as {
  name: string;
  lines: SourceLine[];
  ops: VerifiedOp[];
  sectionOrder: string[];
  excluded: number[];
  expected: TailoredDoc;
}[];

describe("assembleTailoredResume (same cases as the functions copy)", () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    expect(assembleTailoredResume(testCase.lines, testCase.ops, testCase.sectionOrder, new Set(testCase.excluded))).toEqual(
      testCase.expected,
    );
  });
});

const [allKinds] = cases;
const requirements = ["Expert React", "REST API integration", "Kubernetes", "PostgreSQL", "Led a team"];

describe("toChangeRows", () => {
  const { changes, kept } = toChangeRows(allKinds!.ops, allKinds!.lines, requirements, new Set([2]));

  it("lists every applied edit with what it's for", () => {
    expect(changes.map((row) => [row.label, row.requirement, row.included])).toEqual([
      ["Moved up", "REST API integration", true],
      ["Reworded", "PostgreSQL", true],
      ["Cut", "", false],
      ["Added to Skills", "PostgreSQL", true],
      ["Moved up", "Expert React", true],
    ]);
  });

  it("shows before and after for a rewrite and the source line for a Skills entry", () => {
    expect(changes[1]).toMatchObject({
      before: "Maintained Postgres queries for the reporting dashboard.",
      after: "Maintained PostgreSQL queries for the reporting dashboard.",
    });
    expect(changes[3]).toMatchObject({ before: "From: Maintained Postgres queries for the reporting dashboard.", after: "PostgreSQL" });
  });

  it("explains a rewrite that was kept as the original", () => {
    expect(kept).toEqual([
      {
        index: 4,
        kind: "reworded",
        before: "Helped with the migration of legacy screens off ad-hoc state to Redux.",
        explanation: "Kept your original. The suggested wording added “led”, which this line doesn't say.",
      },
    ]);
  });
});

describe("explainRevert", () => {
  const op = (partial: Partial<VerifiedOp>): VerifiedOp => ({
    index: 0,
    kind: "rephrase",
    lineIds: ["L1"],
    text: "",
    term: "",
    requirement: 0,
    reason: "",
    status: "reverted",
    ...partial,
  });

  it("names the words a rewrite added", () => {
    expect(explainRevert(op({ revertReason: "new_fact", offendingTokens: ["term:kubernetes", "lex:lead", "num:95"] }))).toBe(
      "Kept your original. The suggested wording added “kubernetes”, “95”, which this line doesn't say.",
    );
  });

  it("says why a Skills entry wasn't added", () => {
    expect(explainRevert(op({ kind: "surfaceKeyword", term: "Python", revertReason: "qualified_source" }))).toBe(
      "Didn't add “Python” to Skills. This line doesn't say you use it.",
    );
  });

  it("hides reverts that aren't worth showing", () => {
    expect(explainRevert(op({ revertReason: "conflict" }))).toBeNull();
    expect(explainRevert(op({ revertReason: "no_change" }))).toBeNull();
  });
});

describe("docText", () => {
  it("prints the document with headings and bullets", () => {
    const text = docText(allKinds!.expected);
    expect(text).toContain("Sarah Chen");
    expect(text).toContain("• Maintained PostgreSQL queries for the reporting dashboard.");
    expect(text).toContain("React, TypeScript, Redux, Jest\nPostgreSQL");
  });
});

describe("newestTailoredPerJob", () => {
  it("keeps the newest version per resume and job, and counts the rest", () => {
    const versions = [
      { id: "t3", resumeId: "r1", jobApplicationId: "a" },
      { id: "t2", resumeId: "r2", jobApplicationId: "b" },
      { id: "t1", resumeId: "r1", jobApplicationId: "a" },
      { id: "t0", resumeId: "r1", jobApplicationId: "c" },
    ];
    const grouped = newestTailoredPerJob(versions);
    expect(grouped.get("r1")!.map((version) => [version.id, version.count])).toEqual([["t3", 2], ["t0", 1]]);
    expect(grouped.get("r2")!.map((version) => version.id)).toEqual(["t2"]);
  });
});
