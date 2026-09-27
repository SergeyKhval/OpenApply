// @vitest-environment node
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { candidateName, exportFileName, tailoredResumeDocx, tailoredResumeHtml } from "../tailoredResumeExport";
import type { TailoredDoc } from "../tailoredResume";
import fixture from "../../../../shared/tailoredResumeCases.json";

const doc = fixture.cases[0]!.expected as TailoredDoc;
const allLines = doc.sections.flatMap((section) => [...(section.heading ? [section.heading.toUpperCase()] : []), ...section.lines.map((line) => line.text)]);

const xmlText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("exportFileName", () => {
  it("names the file after the candidate and the job", () => {
    expect(exportFileName(doc, { companyName: "Globex", position: "Senior Frontend Engineer" }, "docx")).toBe(
      "Sarah Chen - Globex Senior Frontend Engineer.docx",
    );
  });

  it("drops characters file systems reject", () => {
    expect(exportFileName(doc, { companyName: 'A/B: "C"', position: "Dev<1>" }, "pdf")).toBe("Sarah Chen - AB C Dev1.pdf");
  });

  it("falls back to Resume without a name or job", () => {
    expect(exportFileName({ sections: [] }, {}, "docx")).toBe("Resume.docx");
  });
});

describe("candidateName", () => {
  it("is the first line of the top block", () => {
    expect(candidateName(doc)).toBe("Sarah Chen");
  });
});

describe("tailoredResumeDocx", () => {
  it("writes every line, in order, with real bullets", async () => {
    const blob = await tailoredResumeDocx(doc);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");

    let cursor = 0;
    for (const line of allLines) {
      const at = xml.indexOf(xmlText(line), cursor);
      expect(at, `missing or out of order: ${line}`).toBeGreaterThanOrEqual(0);
      cursor = at;
    }
    const bulletCount = doc.sections.flatMap((section) => section.lines).filter((line) => line.bullet).length;
    expect(xml.match(/<w:numPr>/g)?.length).toBe(bulletCount);
  });

  it("has no tables, text boxes or images", async () => {
    const zip = await JSZip.loadAsync(await (await tailoredResumeDocx(doc)).arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).not.toMatch(/<w:tbl>|<w:txbxContent>|<w:drawing>/);
  });
});

describe("tailoredResumeHtml", () => {
  const html = tailoredResumeHtml(doc, "Sarah Chen - Globex");

  it("puts the name first and each section under its heading", () => {
    expect(html).toContain("<title>Sarah Chen - Globex</title>");
    expect(html.indexOf("<h1>Sarah Chen</h1>")).toBeLessThan(html.indexOf("<h2>Summary</h2>"));
    expect(html).toContain("<li>Maintained PostgreSQL queries for the reporting dashboard.</li>");
  });

  it("escapes resume text", () => {
    const hostile: TailoredDoc = { sections: [{ heading: null, lines: [{ text: "<script>alert(1)</script> & Co", bullet: false, kind: "original", sourceIds: ["L1"] }] }] };
    const out = tailoredResumeHtml(hostile, "x");
    expect(out).not.toContain("<script>alert");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co");
  });
});
