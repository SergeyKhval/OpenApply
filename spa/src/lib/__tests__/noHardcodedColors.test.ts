import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Colors come from the theme tokens (shared/theme.css). Files owned by the
// billing work are restyled once that lands.
const ROOTS = [resolve(__dirname, "../.."), resolve(__dirname, "../../../../astro/src")];
const SKIP = [
  "components/SuccessCheckoutDialog.vue",
  "components/FailureCheckoutDialog.vue",
  "content/",
  "__tests__/",
];
const PALETTE =
  /\b(?:bg|text|border|from|to|via|ring|fill|stroke|outline|divide|decoration|placeholder)-(?:purple|violet|indigo|fuchsia|pink|rose|zinc|slate|gray|neutral|stone|emerald|green|red|amber|yellow|orange|lime|teal|cyan|sky|blue)-\d{2,3}\b/;
const GRADIENT = /\bbg-(?:gradient|linear)-to-/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(vue|astro|ts)$/.test(name) ? [path] : [];
  });

const files = ROOTS.flatMap((root) =>
  walk(root)
    .map((path) => ({ path, name: relative(root, path) }))
    .filter(({ name }) => !SKIP.some((skip) => name.includes(skip))),
);

describe("no hard-coded colors", () => {
  it.each(files.map(({ path, name }) => [name, path]))("%s", (_name, path) => {
    const source = readFileSync(path, "utf8");
    expect(source.match(PALETTE)?.[0] ?? null).toBeNull();
    expect(source.match(GRADIENT)?.[0] ?? null).toBeNull();
  });
});
