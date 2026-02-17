import { describe, it, expect } from "vitest";
import { normalizeFunctionsError } from "../useCoverLetters";

describe("normalizeFunctionsError", () => {
  it("handles null", () => {
    const result = normalizeFunctionsError(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("handles undefined", () => {
    const result = normalizeFunctionsError(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("handles non-object errors", () => {
    const result = normalizeFunctionsError("string error");
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("extracts message from error objects", () => {
    const result = normalizeFunctionsError({ message: "Something failed" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Something failed");
  });

  it("uses fallback for empty message", () => {
    const result = normalizeFunctionsError({ message: "" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("strips functions/ prefix from code", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "functions/not-found",
    });
    expect(result.code).toBe("not-found");
  });

  it("does not strip non-functions prefix codes", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "auth/invalid-email",
    });
    expect(result.code).toBeUndefined();
  });

  it("extracts code from details.code", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "functions/failed-precondition",
      details: { code: "insufficient-credits" },
    });
    expect(result.code).toBe("insufficient-credits");
  });

  it("details.code takes precedence over top-level code", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "functions/something",
      details: { code: "override-code" },
    });
    expect(result.code).toBe("override-code");
  });
});
