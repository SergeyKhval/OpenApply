import { describe, expect, it } from "vitest";
import cases from "../../../../shared/jobKeyCases.json";
import { jobKey, jobKeyHash, jobKeyPrefix } from "../jobKey";

describe("jobKey", () => {
  it.each(cases.keys)("%s", (url, key) => {
    expect(jobKey(url)).toBe(key);
  });

  it("returns null for non-http URLs", () => {
    expect(jobKey("mailto:jobs@example.com")).toBeNull();
    expect(jobKey("not a url")).toBeNull();
  });
});

describe("jobKeyHash", () => {
  it.each(cases.hashes)("%s", (key, hash) => {
    expect(jobKeyHash(key)).toBe(hash);
  });

  it("prefix is the first 4 hex characters", () => {
    expect(jobKeyPrefix("778e892640b1")).toBe("778e");
  });
});
