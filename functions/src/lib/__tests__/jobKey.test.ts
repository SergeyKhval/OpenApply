import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jobKey, jobKeyHash, jobKeyPrefix } from "../jobKey";

// Read, not imported: an import would pull shared/ into tsc's build and move
// lib/index.js to lib/functions/src/index.js
const cases: { keys: [string, string][]; hashes: [string, string][] } = JSON.parse(
  readFileSync(join(__dirname, "../../../../shared/jobKeyCases.json"), "utf8"),
);

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
