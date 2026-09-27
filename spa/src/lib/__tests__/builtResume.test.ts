// @vitest-environment node
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  emptyStructuredResume,
  formatDateRange,
  isResumeComplete,
  sectionHeading,
  serializeResume,
  structuredToDoc,
  type StructuredResume,
} from "../builtResume";
import { docText } from "../tailoredResume";
import { tailoredResumeDocx, tailoredResumeHtml } from "../tailoredResumeExport";
import fixture from "../../../../shared/builtResumeCases.json";

const cases = fixture.cases as { name: string; structured: StructuredResume; text: string }[];
const full = cases[0]!.structured;

describe("serializeResume shared cases", () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    expect(serializeResume(testCase.structured)).toBe(testCase.text);
  });
});

describe("formatDateRange", () => {
  it("writes month and year, or the year alone", () => {
    expect(formatDateRange({ year: 2021, month: 3 }, "present")).toBe("Mar 2021 – Present");
    expect(formatDateRange({ year: 2014, month: null }, { year: 2018, month: null })).toBe("2014 – 2018");
  });

  it("writes one side when the other is missing", () => {
    expect(formatDateRange({ year: 2023, month: 1 }, null)).toBe("Jan 2023");
    expect(formatDateRange(null, { year: 2020, month: null })).toBe("2020");
    expect(formatDateRange(null, null)).toBe("");
  });

  it("ignores a month out of range", () => {
    expect(formatDateRange({ year: 2021, month: 13 }, null)).toBe("2021");
  });
});

describe("sectionHeading", () => {
  it("keeps a heading from the section's list and falls back to its default", () => {
    expect(sectionHeading({ type: "experience", heading: "Work Experience" })).toBe("Work Experience");
    expect(sectionHeading({ type: "experience", heading: "Where I worked" })).toBe("Experience");
    expect(sectionHeading({ type: "skills", heading: "Experience" })).toBe("Skills");
  });
});

describe("structuredToDoc", () => {
  const doc = structuredToDoc(full);

  it("has the same lines as the stored text", () => {
    expect(docText(doc).replace(/\n\n/g, "\n")).toBe(cases[0]!.text);
  });

  it("puts name, headline and contact in the top block", () => {
    expect(doc.sections[0]!.heading).toBeNull();
    expect(doc.sections[0]!.lines.map((line) => line.text)).toEqual([
      "Sarah Chen",
      "Senior Frontend Engineer",
      "sarah.chen@example.com | +48 600 100 200 | Warsaw, Poland | linkedin.com/in/sarahchen | github.com/sarahchen",
    ]);
  });

  it("makes entry headers bold and bullets real bullets", () => {
    const experience = doc.sections.find((section) => section.heading === "Work Experience")!;
    expect(experience.lines.map((line) => [line.strong ?? false, line.bullet])).toEqual([
      [true, false],
      [false, true],
      [false, true],
      [true, false],
      [false, true],
    ]);
  });

  it("has no top block without contact details", () => {
    const doc = structuredToDoc({ ...full, contact: { name: "", headline: "", email: "", phone: "", location: "", links: [] } });
    expect(doc.sections[0]!.heading).toBe("Summary");
  });
});

describe("downloads of a built resume", () => {
  const doc = structuredToDoc(full);

  it("bolds entry headers in the DOCX", async () => {
    const blob = await tailoredResumeDocx(doc);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");
    const header = xml.split("<w:p>").find((paragraph) => paragraph.includes("Senior Frontend Engineer, Globex"))!;
    expect(header).toContain("<w:b/>");
    const bullet = xml.split("<w:p>").find((paragraph) => paragraph.includes("Mentored two junior engineers"))!;
    expect(bullet).not.toContain("<w:b/>");
  });

  it("bolds entry headers in the print view", () => {
    const html = tailoredResumeHtml(doc, "Sarah Chen - Resume");
    expect(html).toContain("<p><strong>Senior Frontend Engineer, Globex | Warsaw | Mar 2021 – Present</strong></p>");
    expect(html).toContain("<li>Mentored two junior engineers through their first releases.</li>");
  });
});

describe("isResumeComplete", () => {
  it("is true for a full resume", () => {
    expect(isResumeComplete(full)).toBe(true);
  });

  it("needs a name and a way to reach you", () => {
    expect(isResumeComplete({ ...full, contact: { ...full.contact, name: " " } })).toBe(false);
    expect(isResumeComplete({ ...full, contact: { ...full.contact, email: "", phone: "", location: "", links: [] } })).toBe(false);
  });

  it("needs a job or a school with some content", () => {
    const noEntries: StructuredResume = {
      ...full,
      sections: [{ id: "s", type: "skills", heading: "Skills", items: ["A", "B", "C"] }],
    };
    expect(isResumeComplete(noEntries)).toBe(false);

    const thin: StructuredResume = {
      ...full,
      sections: [
        {
          id: "s",
          type: "experience",
          heading: "Experience",
          entries: [{ id: "e", title: "Analyst", organization: "Acme", location: "", start: null, end: null, bullets: [{ id: "b", text: "One bullet" }] }],
        },
      ],
    };
    expect(isResumeComplete(thin)).toBe(false);
  });

  it("is false for a new resume", () => {
    expect(isResumeComplete(emptyStructuredResume({ name: "Sarah Chen", email: "sarah@example.com" }))).toBe(false);
  });
});

describe("emptyStructuredResume", () => {
  it("prefills contact and starts with Experience, Education and Skills", () => {
    let next = 0;
    const resume = emptyStructuredResume({ name: "Sarah Chen" }, () => `id${next++}`);
    expect(resume.contact.name).toBe("Sarah Chen");
    expect(resume.sections.map((section) => [section.id, section.type])).toEqual([
      ["id0", "experience"],
      ["id1", "education"],
      ["id2", "skills"],
    ]);
    expect(serializeResume(resume)).toBe("Sarah Chen");
  });
});
