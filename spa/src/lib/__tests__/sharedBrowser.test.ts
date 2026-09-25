import { describe, expect, it } from "vitest";
import { isDesktopChromium } from "../../../../shared/browser";

const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const EDGE_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";
const OPERA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0";
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1";

describe("isDesktopChromium", () => {
  it.each([
    ["Chrome on Mac", CHROME_MAC, true],
    ["Edge on Windows", EDGE_WIN, true],
    ["Chrome on Android", CHROME_ANDROID, false],
    ["Chrome on iPhone", CHROME_IOS, false],
    ["Safari", SAFARI_MAC, false],
    ["Firefox", FIREFOX, false],
    ["Opera", OPERA, false],
  ])("%s", (_name, userAgent, expected) => {
    expect(isDesktopChromium({ userAgent })).toBe(expected);
  });

  it("prefers client hints when the browser has them", () => {
    const brands = [{ brand: "Google Chrome", version: "129" }, { brand: "Chromium", version: "129" }];
    expect(isDesktopChromium({ userAgent: SAFARI_MAC, userAgentData: { brands, mobile: false } })).toBe(true);
    expect(isDesktopChromium({ userAgent: CHROME_MAC, userAgentData: { brands, mobile: true } })).toBe(false);
    expect(isDesktopChromium({ userAgent: CHROME_MAC, userAgentData: { brands: [{ brand: "Brave", version: "1" }], mobile: false } })).toBe(false);
  });

  it("accepts any desktop Chromium browser (they install from the Chrome Web Store)", () => {
    expect(isDesktopChromium({ userAgent: "", userAgentData: { brands: [{ brand: "Chromium" }], mobile: false } })).toBe(true);
  });

  it("falls back to the user agent when client hints have no brands", () => {
    expect(isDesktopChromium({ userAgent: CHROME_MAC, userAgentData: { brands: [], mobile: false } })).toBe(true);
    expect(isDesktopChromium({ userAgent: SAFARI_MAC, userAgentData: { brands: [], mobile: false } })).toBe(false);
  });

  it("still works when its source is inlined on its own, as the landing does before paint", () => {
    const inlined = new Function("nav", `return (${isDesktopChromium.toString()})(nav);`);
    expect(inlined({ userAgent: CHROME_MAC })).toBe(true);
    expect(inlined({ userAgent: FIREFOX })).toBe(false);
  });
});
