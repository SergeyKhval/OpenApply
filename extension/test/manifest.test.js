import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

const root = join(here, "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

// Chrome Web Store review is faster with fewer permissions: keep it this small
describe("manifest", () => {
  it("asks only for the active tab, on click", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab", "scripting"]);
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest).not.toHaveProperty("optional_host_permissions");
    expect(manifest).not.toHaveProperty("content_scripts");
    expect(manifest).not.toHaveProperty("background");
  });

  it("fits the Web Store limits", () => {
    expect(manifest.name.length).toBeLessThanOrEqual(75);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
    expect(manifest.version).toMatch(/^\d+(\.\d+){0,3}$/);
  });

  it("points at files that exist", () => {
    const paths = [
      manifest.action.default_popup,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
    ];
    paths.forEach((path) => expect(existsSync(join(root, path)), path).toBe(true));
  });
});
