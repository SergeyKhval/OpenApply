import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH, nameError, normalizeName } from "../profileName";

describe("normalizeName", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeName("  Maya   Chen ")).toBe("Maya Chen");
  });

  it("turns a blank name into an empty string", () => {
    expect(normalizeName("   ")).toBe("");
  });
});

describe("nameError", () => {
  it("accepts a normal name, and an empty one (clears it)", () => {
    expect(nameError("Maya Chen")).toBeNull();
    expect(nameError("")).toBeNull();
  });

  it("rejects a name that is too long", () => {
    expect(nameError("a".repeat(MAX_NAME_LENGTH))).toBeNull();
    expect(nameError("a".repeat(MAX_NAME_LENGTH + 1))).toBe(`Keep it under ${MAX_NAME_LENGTH} characters.`);
  });
});
