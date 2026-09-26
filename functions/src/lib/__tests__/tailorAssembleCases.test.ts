import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assembleTailoredResume, type TailoredDoc, type VerifiedOp } from "../tailorVerify";
import type { SourceLine } from "../tailorSegment";

// The app rebuilds tailored resumes with its own copy of
// assembleTailoredResume (spa/src/lib/tailoredResume.ts). Both run these
// cases. Read, not imported: an import would pull shared/ into tsc's build.
const { cases }: {
  cases: { name: string; lines: SourceLine[]; ops: VerifiedOp[]; sectionOrder: string[]; excluded: number[]; expected: TailoredDoc }[];
} = JSON.parse(readFileSync(join(__dirname, "../../../../shared/tailoredResumeCases.json"), "utf8"));

describe("assembleTailoredResume shared cases", () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    expect(assembleTailoredResume(testCase.lines, testCase.ops, testCase.sectionOrder, new Set(testCase.excluded))).toEqual(
      testCase.expected,
    );
  });
});
