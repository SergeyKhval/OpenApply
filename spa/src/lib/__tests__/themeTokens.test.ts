import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const tokens = read("../../../../shared/theme.css");

const block = (css: string, selector: ":root" | ".dark") => {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((match) => [
      match[1],
      match[2].toUpperCase(),
    ]),
  );
};

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

describe("app and landing import the same theme", () => {
  it.each(["../../index.css", "../../../../astro/src/styles/global.css"])("%s", (path) => {
    expect(read(path)).toMatch(/@import\s+"[./]*\/shared\/theme\.css"/);
  });
});

describe.each([":root", ".dark"] as const)("theme %s", (selector) => {
  const theme = block(tokens, selector);

  it.each([
    ["foreground", "background"],
    ["soft-foreground", "background"],
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["destructive", "card"],
    ["destructive-foreground", "destructive"],
    ["success", "success-soft"],
    ["stage-saved-text", "stage-saved-soft"],
    ["stage-applied-text", "stage-applied-soft"],
    ["stage-interviewing-text", "stage-interviewing-soft"],
    ["stage-offer-text", "stage-offer-soft"],
    ["stage-closed-text", "stage-closed-soft"],
    ["signal-text", "signal-soft"],
    ["signal-text", "card"],
  ])("%s on %s is at least 4.5:1", (text, surface) => {
    expect(theme[text], `--${text} missing`).toBeDefined();
    expect(theme[surface], `--${surface} missing`).toBeDefined();
    expect(contrast(theme[text], theme[surface])).toBeGreaterThanOrEqual(4.5);
  });
});
