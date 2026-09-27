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

import { generateLinkedinRewrite, type LinkedinRewriteGenerate, type LinkedinRewriteModelOutput } from "../linkedinRewriteEngine";

const input = {
  headline: "Frontend Engineer at Acme Corp",
  about:
    "I build accessible web apps with React and TypeScript.\n\n" +
    "Previously led the checkout redesign at Acme, cutting load time by 30%.",
  targetRole: "",
};

const generating = (output: LinkedinRewriteModelOutput | null): LinkedinRewriteGenerate =>
  vi.fn(async () => ({ output }));

describe("generateLinkedinRewrite", () => {
  it("keeps a faithful rewrite for the headline and every About line", async () => {
    const generate = generating({
      why: "Led with your React and checkout-redesign experience.",
      headline: "Frontend Engineer specializing in React and TypeScript",
      aboutLines: [
        { id: "about-1", text: "I build accessible React and TypeScript web apps." },
        { id: "about-2", text: "Cut checkout load time 30% by leading the redesign at Acme." },
      ],
    });

    const result = await generateLinkedinRewrite(input, generate);

    expect(result.headline.changed).toBe(true);
    expect(result.about).toHaveLength(2);
    expect(result.about.every((line) => line.changed)).toBe(true);
    expect(result.why).toBe("Led with your React and checkout-redesign experience.");
    expect(result.stats).toEqual({ proposed: 3, changed: 3, kept: 0 });
  });

  it("reverts a line that invents a fact and keeps the rest", async () => {
    const generate = generating({
      why: "Sharpened the wording.",
      headline: "Senior Frontend Engineer at Acme Corp",
      aboutLines: [
        { id: "about-1", text: "I build accessible web apps with React and TypeScript." },
        { id: "about-2", text: "Previously led the checkout redesign at Acme, cutting load time by 30%." },
      ],
    });

    const result = await generateLinkedinRewrite(input, generate);

    // "Senior" is not in the source headline, so it's an invented credential
    expect(result.headline).toMatchObject({ changed: false, revertReason: "new_fact", text: input.headline });
    expect(result.stats).toEqual({ proposed: 3, changed: 0, kept: 3 });
  });

  it("keeps an About line untouched when the model doesn't return it", async () => {
    const generate = generating({
      why: "Tightened the headline only.",
      headline: "Frontend Engineer building accessible apps",
      aboutLines: [{ id: "about-1", text: "I build accessible React and TypeScript web apps." }],
    });

    const result = await generateLinkedinRewrite(input, generate);

    expect(result.about[1]).toMatchObject({
      id: "about-2",
      changed: false,
      revertReason: "no_change",
      text: "Previously led the checkout redesign at Acme, cutting load time by 30%.",
    });
  });

  it("caps the why line at 300 characters", async () => {
    const generate = generating({
      why: "a".repeat(400),
      headline: input.headline,
      aboutLines: [],
    });

    const result = await generateLinkedinRewrite(input, generate);
    expect(result.why).toHaveLength(300);
  });

  it("maps generation failures to an internal error", async () => {
    const generate: LinkedinRewriteGenerate = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(generateLinkedinRewrite(input, generate)).rejects.toThrow("wrong turn");
  });

  it("fails when the model returns no output", async () => {
    const generate = generating(null);
    await expect(generateLinkedinRewrite(input, generate)).rejects.toThrow("came back empty");
  });
});
