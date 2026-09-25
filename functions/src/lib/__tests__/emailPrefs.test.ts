import { describe, expect, it } from "vitest";
import { parseEmailPrefs, wantsWeeklyDigest } from "../emailPrefs";

describe("wantsWeeklyDigest", () => {
  it("is on unless someone turned it off", () => {
    expect(wantsWeeklyDigest(undefined)).toBe(true);
    expect(wantsWeeklyDigest({})).toBe(true);
    expect(wantsWeeklyDigest({ emailPrefs: {} })).toBe(true);
    expect(wantsWeeklyDigest({ emailPrefs: { weeklyDigest: true } })).toBe(true);
    expect(wantsWeeklyDigest({ emailPrefs: { weeklyDigest: false } })).toBe(false);
  });
});

describe("parseEmailPrefs", () => {
  it("accepts a boolean weeklyDigest", () => {
    expect(parseEmailPrefs({ weeklyDigest: false })).toEqual({ weeklyDigest: false });
  });

  it("drops unknown fields", () => {
    expect(parseEmailPrefs({ weeklyDigest: true, admin: true })).toEqual({ weeklyDigest: true });
  });

  it.each([undefined, null, "off", {}, { weeklyDigest: "false" }, { weeklyDigest: 0 }])("rejects %j", (input) => {
    expect(() => parseEmailPrefs(input)).toThrow("weeklyDigest must be true or false");
  });
});
