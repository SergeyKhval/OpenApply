// @vitest-environment node
import { describe, expect, it } from "vitest";
import cases from "../../shared/jobKeyCases.json";
import { jobKey, jobKeyHash, jobKeyPrefix } from "../src/jobKey.js";

// Same cases as functions/src/lib/__tests__/jobKey.test.ts: both sides must agree
describe("jobKey", () => {
  it.each(cases.keys)("%s", (url, key) => {
    expect(jobKey(url)).toBe(key);
  });

  it("returns null for non-http URLs", () => {
    expect(jobKey("mailto:jobs@example.com")).toBeNull();
  });
});

describe("jobKeyHash", () => {
  it.each(cases.hashes)("%s", async (key, hash) => {
    expect(await jobKeyHash(key)).toBe(hash);
  });

  it("prefix is the first 4 hex characters", () => {
    expect(jobKeyPrefix("778e892640b1")).toBe("778e");
  });
});
