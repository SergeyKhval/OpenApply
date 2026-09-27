import { describe, it, expect } from "vitest";
import {
  DAILY_GLOBAL_LIMIT,
  DAILY_LIMIT_PER_CLIENT,
  HOURLY_LIMIT_PER_CLIENT,
  MAX_ABOUT_CHARS,
  MAX_HEADLINE_CHARS,
  MIN_ABOUT_CHARS,
  MIN_HEADLINE_CHARS,
  assertWithinLimits,
  buildLinkedinRewritePrompt,
  segmentAbout,
  validateLinkedinRewriteInput,
  verifyLinkedinRewriteLine,
} from "../linkedinRewriteTool";

const headline = "Frontend Engineer at Acme Corp";
const about =
  "I build accessible web apps with React and TypeScript.\n\n" +
  "Previously led the checkout redesign at Acme, cutting load time by 30%.";

describe("validateLinkedinRewriteInput", () => {
  it("returns trimmed input with an empty target role by default", () => {
    expect(validateLinkedinRewriteInput({ headline: `  ${headline}  `, about })).toEqual({
      headline,
      about,
      targetRole: "",
    });
  });

  it("trims and keeps a provided target role", () => {
    expect(
      validateLinkedinRewriteInput({ headline, about, targetRole: "  Senior Frontend Engineer  " }),
    ).toEqual({ headline, about, targetRole: "Senior Frontend Engineer" });
  });

  it("rejects non-object payloads", () => {
    expect(() => validateLinkedinRewriteInput(null)).toThrow("Paste your headline");
  });

  it("rejects missing fields", () => {
    expect(() => validateLinkedinRewriteInput({ headline })).toThrow("Paste your headline");
  });

  it("rejects a too-short headline", () => {
    expect(() => validateLinkedinRewriteInput({ headline: "PM", about })).toThrow(
      "headline looks too short",
    );
  });

  it("rejects a too-short about section", () => {
    expect(() => validateLinkedinRewriteInput({ headline, about: "short" })).toThrow(
      "About section looks too short",
    );
  });

  it("rejects an oversized headline", () => {
    expect(() =>
      validateLinkedinRewriteInput({ headline: "a".repeat(MAX_HEADLINE_CHARS + 1), about }),
    ).toThrow("headline is over");
  });

  it("rejects an oversized about section", () => {
    expect(() =>
      validateLinkedinRewriteInput({ headline, about: "a".repeat(MAX_ABOUT_CHARS + 1) }),
    ).toThrow("About section is over");
  });

  it("rejects an oversized target role", () => {
    expect(() =>
      validateLinkedinRewriteInput({ headline, about, targetRole: "a".repeat(101) }),
    ).toThrow("target role is over");
  });

  it("rejects a non-string target role", () => {
    expect(() => validateLinkedinRewriteInput({ headline, about, targetRole: 5 })).toThrow(
      "Paste your headline",
    );
  });
});

describe("segmentAbout", () => {
  it("splits on blank lines into paragraphs with stable ids", () => {
    expect(segmentAbout(about)).toEqual([
      { id: "about-1", text: "I build accessible web apps with React and TypeScript." },
      {
        id: "about-2",
        text: "Previously led the checkout redesign at Acme, cutting load time by 30%.",
      },
    ]);
  });

  it("falls back to single newlines when there are no blank lines", () => {
    expect(segmentAbout("Line one.\nLine two.\nLine three.")).toEqual([
      { id: "about-1", text: "Line one." },
      { id: "about-2", text: "Line two." },
      { id: "about-3", text: "Line three." },
    ]);
  });

  it("treats a single-paragraph about section as one line", () => {
    expect(segmentAbout("One long paragraph with no line breaks at all.")).toEqual([
      { id: "about-1", text: "One long paragraph with no line breaks at all." },
    ]);
  });

  it("drops blank lines and trims whitespace", () => {
    expect(segmentAbout("First.\n\n\n\n   Second.   \n\n")).toEqual([
      { id: "about-1", text: "First." },
      { id: "about-2", text: "Second." },
    ]);
  });
});

describe("buildLinkedinRewritePrompt", () => {
  it("embeds the headline, about lines and hard rule against inventing facts", () => {
    const prompt = buildLinkedinRewritePrompt(
      { headline, about, targetRole: "Senior Frontend Engineer" },
      segmentAbout(about),
    );
    expect(prompt).toContain(headline);
    expect(prompt).toContain("about-1 | I build accessible web apps with React and TypeScript.");
    expect(prompt).toContain("Senior Frontend Engineer");
    expect(prompt.toLowerCase()).toContain("never invent");
  });

  it("says so when no target role was given", () => {
    const prompt = buildLinkedinRewritePrompt({ headline, about, targetRole: "" }, segmentAbout(about));
    expect(prompt).toContain("No target role given");
  });
});

describe("verifyLinkedinRewriteLine", () => {
  const source = "Led the checkout redesign at Acme, cutting load time by 30%.";

  it("accepts a faithful rephrase", () => {
    const result = verifyLinkedinRewriteLine(
      "about-1",
      source,
      "Cut checkout load time 30% by leading the redesign at Acme.",
      source,
    );
    expect(result).toMatchObject({ id: "about-1", changed: true });
    expect(result.text).not.toBe(source);
  });

  it("reverts a rewrite that invents a number", () => {
    const result = verifyLinkedinRewriteLine(
      "about-1",
      source,
      "Led the checkout redesign at Acme, cutting load time by 50%.",
      source,
    );
    expect(result).toMatchObject({ id: "about-1", changed: false, revertReason: "new_fact", text: source });
  });

  it("reverts a rewrite that invents a tool or employer not in the source", () => {
    const result = verifyLinkedinRewriteLine(
      "about-1",
      source,
      "Led the checkout redesign at Acme using React, cutting load time by 30%.",
      source,
    );
    expect(result).toMatchObject({ changed: false, revertReason: "new_fact" });
  });

  it("reverts a rewrite that adds seniority or ownership not stated", () => {
    const helped = "Helped with the checkout redesign at Acme.";
    const result = verifyLinkedinRewriteLine("about-1", helped, "Led the checkout redesign at Acme.", helped);
    expect(result).toMatchObject({ changed: false, revertReason: "new_fact" });
  });

  it("reverts a rewrite that adds an intensifier the source doesn't have", () => {
    const plain = "Worked on the checkout redesign project for the customer app at Acme this year.";
    const result = verifyLinkedinRewriteLine(
      "about-1",
      plain,
      "Worked on the critical, high-impact checkout redesign project for the customer app at Acme this year.",
      plain,
    );
    expect(result).toMatchObject({ changed: false, revertReason: "new_fact" });
  });

  it("reverts a rewrite that drops a qualifier, inflating a hedged claim", () => {
    const hedged = "Started learning Python as a side project.";
    const result = verifyLinkedinRewriteLine("about-1", hedged, "Learned Python.", hedged);
    expect(result).toMatchObject({ changed: false, revertReason: "dropped_qualifier" });
  });

  it("reverts a rewrite that claims a team's work as the candidate's own", () => {
    const teamWork = "Worked alongside the data science team's Python and TensorFlow engineers.";
    const result = verifyLinkedinRewriteLine("about-1", teamWork, "Built Python and TensorFlow tools.", teamWork);
    expect(result).toMatchObject({ changed: false, revertReason: "others_work" });
  });

  it("allows a rewrite to honestly reuse a fact stated elsewhere in the pasted text, not just this line", () => {
    // The headline names no tools; "React" only appears in the About section.
    // A headline rewrite that surfaces it is a repositioning, not an invention.
    const wholeSourceText = "Frontend Engineer at Acme Corp\n\nI build apps with React and TypeScript.";
    const result = verifyLinkedinRewriteLine(
      "headline",
      "Frontend Engineer at Acme Corp",
      "Frontend Engineer specializing in React and TypeScript",
      wholeSourceText,
    );
    expect(result).toMatchObject({ changed: true, text: "Frontend Engineer specializing in React and TypeScript" });
  });

  it("still blocks a fact that appears nowhere in the pasted text at all", () => {
    const wholeSourceText = "Frontend Engineer at Acme Corp\n\nI build apps with React and TypeScript.";
    const result = verifyLinkedinRewriteLine(
      "headline",
      "Frontend Engineer at Acme Corp",
      "Senior Frontend Engineer at Acme Corp",
      wholeSourceText,
    );
    expect(result).toMatchObject({ changed: false, revertReason: "new_fact" });
  });

  it("reverts a rewrite that borrows a lowercase skill named only in the target role", () => {
    const headline = "Backend Engineer at Acme";
    const original = "I write backend services in Java at Acme.";
    const wholeSourceText = `${headline}\n\n${original}`;
    const result = verifyLinkedinRewriteLine(
      "about-1",
      original,
      "I write backend services in Java and kubernetes at Acme.",
      wholeSourceText,
      "Kubernetes Platform Engineer",
    );
    expect(result).toMatchObject({ changed: false, revertReason: "new_fact", text: original });
  });

  it("does not flag a target role's word when it's already in the pasted text", () => {
    const headline = "Kubernetes Platform Engineer at Acme";
    const original = "I run our Kubernetes clusters at Acme.";
    const wholeSourceText = `${headline}\n\n${original}`;
    const result = verifyLinkedinRewriteLine(
      "about-1",
      original,
      "I operate our Kubernetes clusters at Acme.",
      wholeSourceText,
      "Kubernetes Platform Engineer",
    );
    expect(result).toMatchObject({ changed: true });
  });

  it("reverts a rewrite that stitches on a job word the pasted text has no match for (unsupportedJobWords)", () => {
    const headline = "Backend Engineer at Acme";
    const original = "I manage a product line at Acme.";
    const wholeSourceText = `${headline}\n\n${original}`;
    const result = verifyLinkedinRewriteLine(
      "about-1",
      original,
      "I manage our growth-focused product line at Acme.",
      wholeSourceText,
      "Growth-focused Product Manager",
    );
    expect(result).toMatchObject({ changed: false, revertReason: "job_word", text: original });
  });

  it("keeps the original wording when the rewrite is identical", () => {
    const result = verifyLinkedinRewriteLine("about-1", source, source, source);
    expect(result).toMatchObject({ changed: false, revertReason: "no_change", text: source });
  });

  it("keeps the original wording when the model returns nothing", () => {
    const result = verifyLinkedinRewriteLine("about-1", source, "   ", source);
    expect(result).toMatchObject({ changed: false, revertReason: "empty_text", text: source });
  });

  it("reverts a rewrite that pads far past the source length", () => {
    const short = "Led the checkout redesign.";
    const result = verifyLinkedinRewriteLine(
      "about-1",
      short,
      "Led the checkout redesign, a sweeping and comprehensive initiative that touched every part of the customer journey from start to finish across the whole company.",
      short,
    );
    expect(result).toMatchObject({ changed: false, revertReason: "too_long" });
  });
});

describe("assertWithinLimits", () => {
  it("allows requests under every limit", () => {
    expect(() => assertWithinLimits({ hourly: 0, daily: 0, global: 0 })).not.toThrow();
  });

  it("blocks at the hourly limit", () => {
    expect(() =>
      assertWithinLimits({ hourly: HOURLY_LIMIT_PER_CLIENT, daily: 0, global: 0 }),
    ).toThrow("this hour");
  });

  it("blocks at the daily limit", () => {
    expect(() =>
      assertWithinLimits({ hourly: 0, daily: DAILY_LIMIT_PER_CLIENT, global: 0 }),
    ).toThrow("today's free limit");
  });

  it("blocks at the global limit", () => {
    expect(() =>
      assertWithinLimits({ hourly: 0, daily: 0, global: DAILY_GLOBAL_LIMIT }),
    ).toThrow("daily limit");
  });
});

describe("shared constants sanity", () => {
  it("keeps min below max for both fields", () => {
    expect(MIN_HEADLINE_CHARS).toBeLessThan(MAX_HEADLINE_CHARS);
    expect(MIN_ABOUT_CHARS).toBeLessThan(MAX_ABOUT_CHARS);
  });
});
