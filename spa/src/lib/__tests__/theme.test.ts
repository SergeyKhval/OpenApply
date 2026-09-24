import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  readPreference,
  resolveTheme,
  setThemePreference,
  THEME_STORAGE_KEY,
} from "../theme";

const mediaQuery = (matches: boolean) => ({ matches }) as MediaQueryList;

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
  });

  it("system follows the OS", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("an explicit choice wins over the OS", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("unknown stored values fall back to system", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(readPreference()).toBe("system");
  });

  it("storage that throws falls back to system", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(readPreference(blocked)).toBe("system");
  });

  it("applyTheme sets the dark class and color-scheme", () => {
    applyTheme("system", document.documentElement, mediaQuery(true));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    applyTheme("system", document.documentElement, mediaQuery(false));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("setThemePreference stores explicit choices and clears system", () => {
    vi.stubGlobal("matchMedia", () => mediaQuery(false));
    setThemePreference("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    setThemePreference("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("pre-paint script", () => {
  it.each(["../../../index.html", "../../../../astro/src/layouts/Layout.astro"])(
    "%s sets the theme before styles load and does not hard-code dark",
    (path) => {
      const html = readFileSync(resolve(__dirname, path), "utf8");
      expect(html).not.toMatch(/<html[^>]*class="dark"/);
      const script = html.indexOf(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
      expect(script).toBeGreaterThan(-1);
      const firstStylesheet = html.indexOf('rel="stylesheet"');
      expect(firstStylesheet === -1 || script < firstStylesheet).toBe(true);
    },
  );
});
