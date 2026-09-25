import { describe, it, expect } from "vitest";
import { safeReturnUrl } from "../billingProfile";

const fallback = "https://openapply.app/app/jobs";

describe("safeReturnUrl", () => {
  it.each([
    "https://openapply.app/app/jobs?dialog-name=checkout-success",
    "https://www.openapply.app/app/",
    "http://localhost:5173/app/dashboard/applications",
    "http://127.0.0.1:5180/app/",
  ])("keeps %s", (url) => {
    expect(safeReturnUrl(url, fallback)).toBe(url);
  });

  it.each([
    "https://evil.example/phish",
    "https://openapply.app.evil.example/",
    "javascript:alert(1)",
    "not a url",
    "",
    undefined,
  ])("replaces %s with the fallback", (url) => {
    expect(safeReturnUrl(url, fallback)).toBe(fallback);
  });
});
