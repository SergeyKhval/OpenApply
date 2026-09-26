import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { HttpsError };
});

vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return { ...actual, genkit: () => ({ generate: vi.fn() }) };
});

vi.mock("@genkit-ai/googleai", () => ({
  googleAI: Object.assign(() => ({}), { model: () => ({}) }),
}));

import { buildTailorPrompt, tailorResume, type TailorGenerate, type TailorModelOutput } from "../tailorEngine";
import { segmentResume } from "../tailorSegment";
import { ANALYSIS, RESUME } from "./tailorFixtures";

const usage = { inputTokens: 3000, outputTokens: 1500, thoughtsTokens: 600 };
const generating = (output: TailorModelOutput | null): TailorGenerate => vi.fn(async () => ({ output, usage }));
const lineId = (start: string) => segmentResume(RESUME).find((line) => line.text.startsWith(start))!.id;
const edit = (partial: Partial<TailorModelOutput["ops"][number]> & Pick<TailorModelOutput["ops"][number], "kind" | "lineIds">) => ({
  text: "",
  term: "",
  requirement: 0,
  reason: "",
  ...partial,
});

describe("buildTailorPrompt", () => {
  const prompt = buildTailorPrompt(segmentResume(RESUME), ANALYSIS);

  it("labels each line with what the model may do to it", () => {
    expect(prompt).toContain(`${lineId("Mar 2019")} | FIXED | Mar 2019 – Present`);
    expect(prompt).toContain(`${lineId("Built the core")} | EDITABLE | Built the core`);
    expect(prompt).toContain(`${lineId("Skills")} | SECTION | Skills`);
  });

  it("numbers the requirements and names the terms it must never add", () => {
    expect(prompt).toContain("2. [must-have, missing] Kubernetes");
    expect(prompt).toContain("Never add any of these anywhere");
    expect(prompt).toContain("Kubernetes, GraphQL, Next.js");
  });
});

describe("tailorResume", () => {
  it("refuses a scrambled resume without calling the model", async () => {
    const generate = generating(null);
    await expect(
      tailorResume({ resumeText: RESUME, analysis: { ...ANALYSIS, parseCheck: { status: "scrambled", note: "" } } }, generate),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("refuses a resume with nothing editable", async () => {
    await expect(
      tailorResume({ resumeText: "Sarah Chen\nsarah@example.com", analysis: ANALYSIS }, generating(null)),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("maps model failures to a friendly internal error", async () => {
    const failing: TailorGenerate = async () => {
      throw new Error("quota");
    };
    await expect(tailorResume({ resumeText: RESUME, analysis: ANALYSIS }, failing)).rejects.toMatchObject({ code: "internal" });
    await expect(tailorResume({ resumeText: RESUME, analysis: ANALYSIS }, generating(null))).rejects.toMatchObject({ code: "internal" });
  });

  it("applies honest edits, reverts invented ones, and returns stats and usage", async () => {
    const result = await tailorResume(
      { resumeText: RESUME, analysis: ANALYSIS },
      generating({
        headerLineIds: [],
        sectionOrder: [],
        ops: [
          edit({ kind: "rephrase", lineIds: [lineId("Maintained Postgres")], text: "Maintained PostgreSQL queries for the reporting dashboard.", requirement: 3 }),
          edit({ kind: "rephrase", lineIds: [lineId("Helped with")], text: "Led the Redux migration of legacy screens.", requirement: 4 }),
          edit({ kind: "surfaceKeyword", lineIds: [lineId("Built the core")], term: "Kubernetes", requirement: 2 }),
        ],
      }),
    );

    expect(result.ops.map((op) => op.status)).toEqual(["applied", "reverted", "reverted"]);
    expect(result.stats).toEqual({ proposed: 3, applied: 1, reverted: 2, byReason: { new_fact: 1, term_not_in_source: 1 } });
    expect(result.usage).toEqual(usage);
    const text = result.doc.sections.flatMap((section) => section.lines.map((line) => line.text)).join("\n");
    expect(text).toContain("Maintained PostgreSQL queries");
    expect(text).not.toContain("Kubernetes");
    expect(text).not.toMatch(/\bLed\b/);
  });

  it("locks lines the model says are headers", async () => {
    const result = await tailorResume(
      { resumeText: RESUME, analysis: ANALYSIS },
      generating({
        headerLineIds: [lineId("Organized")],
        sectionOrder: [],
        ops: [edit({ kind: "cut", lineIds: [lineId("Organized")], requirement: -1 })],
      }),
    );
    expect(result.ops[0].revertReason).toBe("locked_line");
  });

  it("caps the number of edits", async () => {
    const ops = Array.from({ length: 60 }, () => edit({ kind: "moveUp", lineIds: [lineId("Raised")] }));
    const result = await tailorResume({ resumeText: RESUME, analysis: ANALYSIS }, generating({ headerLineIds: [], sectionOrder: [], ops }));
    expect(result.ops).toHaveLength(40);
  });
});
