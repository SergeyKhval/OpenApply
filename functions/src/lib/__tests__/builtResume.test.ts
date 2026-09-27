import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECTION_HEADINGS, serializeResume, serializeResumeLines, type StructuredResume } from "../builtResume";
import { isSectionHeading, segmentResume } from "../tailorSegment";

// The app derives userResumes.text with its own copy of serializeResume
// (spa/src/lib/builtResume.ts). Both run these cases. Read, not imported: an
// import would pull shared/ into tsc's build.
const { cases }: { cases: { name: string; structured: StructuredResume; text: string }[] } = JSON.parse(
  readFileSync(join(__dirname, "../../../../shared/builtResumeCases.json"), "utf8"),
);

describe("serializeResume shared cases", () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    expect(serializeResume(testCase.structured)).toBe(testCase.text);
  });
});

// The contract with tailoring: tailorSegment reads a built resume's text the
// way the builder means it. Contact lines and entry headers are locked (never
// edited), headings start sections, and every bullet stays with its own job.
// Known gap, same as a PDF: an entry header with no date or degree, in a
// section with no bullets at all, reads as editable text.
describe("built resume text through tailorSegment", () => {
  const withText = cases.filter((testCase) => testCase.text);

  it.each(withText.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    const expected = serializeResumeLines(testCase.structured);
    const segmented = segmentResume(testCase.text);

    // One source line per serialized line: nothing merged or dropped
    expect(segmented.map((line) => line.text)).toEqual(expected.map((line) => line.text));

    expected.forEach((line, index) => {
      const source = segmented[index]!;
      const where = `${line.kind}: ${line.text}`;
      switch (line.kind) {
        case "name":
        case "headline":
        case "contact":
          expect(source.role, where).toBe("locked");
          expect(source.section, where).toBeNull();
          break;
        case "heading":
          expect(source.role, where).toBe("heading");
          break;
        case "entryHeader":
          expect(source.role, where).toBe("locked");
          break;
        case "bullet":
          expect(source.role, where).toBe("bullet");
          expect(source.bullet, where).toBe(true);
          expect(source.owner, where).toBe(`L${line.owner! + 1}`);
          break;
        case "text":
          expect(source.role, where).toBe("bullet");
          expect(source.bullet, where).toBe(false);
          break;
      }
    });
  });

  it("offers only headings tailorSegment recognizes", () => {
    for (const heading of Object.values(SECTION_HEADINGS).flat()) {
      expect(isSectionHeading(heading), heading).toBe(true);
    }
  });
});
