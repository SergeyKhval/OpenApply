import { describe, expect, it, vi } from "vitest";

vi.mock("genkit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("genkit")>()),
  genkit: () => ({ generate: vi.fn() }),
}));
vi.mock("@genkit-ai/googleai", () => ({ googleAI: Object.assign(() => ({}), { model: () => ({}) }) }));

import { toJsonSchema } from "genkit/schema";
import { buildImportPrompt, importResumeText, ImportModelOutputSchema, type ImportGenerate } from "../importEngine";
import { segmentResume } from "../tailorSegment";
import type { ImportProposal } from "../importVerify";

const TEXT = `Maya Chen
maya@example.com
Experience
Engineer, Acme | 2020 – 2024
• Built a Vue 3 design system.
• Ran the weekly release.`;

const usage = { inputTokens: 1000, outputTokens: 300, thoughtsTokens: 200 };
const empty = { text: "", lineId: "" };

const good: ImportProposal = {
  contact: { name: { text: "Maya Chen", lineId: "L1" }, headline: empty, email: { text: "maya@example.com", lineId: "L2" }, phone: empty, location: empty, links: [] },
  sections: [
    {
      type: "experience",
      headingLineId: "L3",
      summaryLineIds: [],
      items: [],
      entries: [
        {
          headerLineIds: ["L4"],
          title: { text: "Engineer", lineId: "L4" },
          organization: { text: "Acme", lineId: "L4" },
          location: empty,
          start: { year: 2020, month: 0, lineId: "L4" },
          end: { year: 2024, month: 0, lineId: "L4" },
          endIsPresent: false,
          bulletLineIds: ["L5", "L6"],
        },
      ],
    },
  ],
};

describe("buildImportPrompt", () => {
  it("numbers every line with its role and glyph", () => {
    const prompt = buildImportPrompt(segmentResume(TEXT), "resume");
    expect(prompt).toContain("L4 | FIXED | Engineer, Acme | 2020 – 2024");
    expect(prompt).toContain("L5 | TEXT • | Built a Vue 3 design system.");
  });

  it("warns about LinkedIn's page chrome for pasted profiles", () => {
    expect(buildImportPrompt(segmentResume(TEXT), "linkedin_paste")).toContain("Show all");
  });
});

describe("ImportModelOutputSchema", () => {
  it("has no $ref, which Gemini's response_schema rejects", () => {
    expect(JSON.stringify(toJsonSchema({ schema: ImportModelOutputSchema }))).not.toContain("$ref");
  });

  it("accepts a proposal in the verifier's shape", () => {
    expect(ImportModelOutputSchema.parse(good)).toEqual(good);
  });
});

describe("importResumeText", () => {
  it("uses the model's structure when it holds up", async () => {
    const generate: ImportGenerate = async () => ({ output: good, usage });
    const result = await importResumeText(TEXT, "resume", generate);
    expect(result.fallback).toBe(false);
    expect(result.usage).toEqual(usage);
    expect(result.structured.sections[0]).toMatchObject({ type: "experience", entries: [{ title: "Engineer", organization: "Acme" }] });
  });

  it("falls back to the lines alone when the model throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await importResumeText(TEXT, "resume", async () => {
      throw new Error("quota");
    });
    expect(result.fallback).toBe(true);
    expect(result.stats).toMatchObject({ entries: 1, bulletsImported: 2 });
  });

  it("falls back when the model returns nothing", async () => {
    const result = await importResumeText(TEXT, "resume", async () => ({ output: null, usage }));
    expect(result.fallback).toBe(true);
  });

  it("keeps the model's result when it places fewer bullets than the lines alone", async () => {
    const fewer: ImportProposal = {
      ...good,
      sections: [{ ...good.sections[0]!, entries: [{ ...good.sections[0]!.entries[0]!, bulletLineIds: ["L5"] }] }],
    };
    const result = await importResumeText(TEXT, "resume", async () => ({ output: fewer, usage }));
    expect(result.fallback).toBe(false);
    expect(result.notImported).toEqual(["Ran the weekly release."]);
  });

  it("falls back when no entry survives but the lines alone give some", async () => {
    const thin: ImportProposal = { ...good, sections: [] };
    const result = await importResumeText(TEXT, "resume", async () => ({ output: thin, usage }));
    expect(result.fallback).toBe(true);
    expect(result.usage).toEqual(usage);
  });

  it("never lets the model's own text into a bullet", async () => {
    const forged: ImportProposal = {
      ...good,
      sections: [
        {
          ...good.sections[0]!,
          entries: [{ ...good.sections[0]!.entries[0]!, title: { text: "Lead Engineer", lineId: "L4" } }],
        },
      ],
    };
    const result = await importResumeText(TEXT, "resume", async () => ({ output: forged, usage }));
    expect(JSON.stringify(result.structured)).not.toContain("Lead Engineer");
    expect(result.flaggedFields).toHaveLength(1);
  });
});
