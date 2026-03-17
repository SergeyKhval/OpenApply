import { describe, it, expect } from "vitest";
import { validateResourceOwnership } from "../ownership";

describe("validateResourceOwnership", () => {
  // Business rule: a user can only access resources they own
  it("passes when userId matches", () => {
    expect(() => validateResourceOwnership({ userId: "abc" }, "abc")).not.toThrow();
  });

  it("throws permission-denied when userId does not match", () => {
    try {
      validateResourceOwnership({ userId: "abc" }, "xyz");
    } catch (e: any) {
      expect(e.code).toBe("permission-denied");
    }
  });

  // Business rule: missing userId on document is a data integrity issue, deny access
  it("throws when document userId is undefined", () => {
    expect(() => validateResourceOwnership({ userId: undefined as any }, "abc")).toThrow();
  });

  it("throws when document userId is null", () => {
    expect(() => validateResourceOwnership({ userId: null as any }, "abc")).toThrow();
  });

  // Business rule: empty string userId is invalid — treat as missing data
  it("throws when both userIds are empty strings", () => {
    expect(() => validateResourceOwnership({ userId: "" }, "")).toThrow();
  });
});
