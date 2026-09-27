import { describe, expect, it } from "vitest";
import { useProductionFirebase } from "../useProductionFirebase";

describe("useProductionFirebase", () => {
  it("is false when unset", () => {
    expect(useProductionFirebase({})).toBe(false);
  });

  it("is false for the string 'false' (not just falsy)", () => {
    expect(useProductionFirebase({ VITE_USE_PRODUCTION_FIREBASE: "false" })).toBe(false);
  });

  it("is true only for the exact string 'true'", () => {
    expect(useProductionFirebase({ VITE_USE_PRODUCTION_FIREBASE: "true" })).toBe(true);
  });

  it("is false for any other value", () => {
    expect(useProductionFirebase({ VITE_USE_PRODUCTION_FIREBASE: "1" })).toBe(false);
    expect(useProductionFirebase({ VITE_USE_PRODUCTION_FIREBASE: "" })).toBe(false);
  });
});
