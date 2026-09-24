import { describe, expect, it } from "vitest";
import { getCompanyAvatarColor } from "../companyAvatarColor";

describe("getCompanyAvatarColor", () => {
  it("returns one of the seven theme tints", () => {
    for (const name of ["Northwind Labs", "Quillsoft", "", "Ünïcødé GmbH"]) {
      expect(getCompanyAvatarColor(name)).toMatch(/^var\(--avatar-[1-7]\)$/);
    }
  });

  it("is stable for the same company", () => {
    expect(getCompanyAvatarColor("Tessel")).toBe(getCompanyAvatarColor("Tessel"));
  });
});
