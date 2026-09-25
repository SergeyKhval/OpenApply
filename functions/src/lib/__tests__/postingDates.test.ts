import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { postingFromHtml } from "../postingDates";

// Real pages the extension tests use, captured 2026-09-24
const fixture = (name: string) =>
  readFileSync(join(__dirname, "../../../../extension/test/fixtures", `${name}.html`), "utf8");
const now = Date.parse("2026-09-25T12:00:00Z");
const page = (jsonLd: string) =>
  `<html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`;

describe("postingFromHtml", () => {
  it.each([
    ["ashby", { postedAt: "2026-04-07", postedAtSource: "json-ld" }],
    ["lever", { postedAt: "2026-06-23", postedAtSource: "json-ld" }],
    ["workable", { postedAt: "2026-09-21", postedAtSource: "json-ld" }],
    ["linkedin", { postedAt: "2026-09-22", postedAtSource: "json-ld", validThrough: "2026-10-31" }],
    ["theprotocol", { postedAt: "2026-09-16", postedAtSource: "json-ld", validThrough: "2026-10-16" }],
  ])("%s", (name, expected) => {
    expect(postingFromHtml(fixture(name), now)).toEqual(expected);
  });

  it("finds a JobPosting inside @graph", () => {
    const graph = '{"@graph":[{"@type":"WebPage"},{"@type":"JobPosting","datePosted":"2025-05-16","validThrough":"2026-12-31T00:00:00Z"}]}';
    expect(postingFromHtml(page(graph), now)).toEqual({
      postedAt: "2025-05-16",
      postedAtSource: "json-ld",
      validThrough: "2026-12-31",
    });
  });

  it("returns undefined when there is no JobPosting date", () => {
    expect(postingFromHtml(fixture("greenhouse"), now)).toBeUndefined();
    expect(postingFromHtml("<html><body>No data</body></html>", now)).toBeUndefined();
    expect(postingFromHtml(page("{not json"), now)).toBeUndefined();
    expect(postingFromHtml(page('{"@type":"Organization","datePosted":"2026-01-01"}'), now)).toBeUndefined();
  });

  it("ignores future, pre-2000 and malformed dates", () => {
    expect(postingFromHtml(page('{"@type":"JobPosting","datePosted":"2026-12-01"}'), now)).toBeUndefined();
    expect(postingFromHtml(page('{"@type":"JobPosting","datePosted":"1999-01-01"}'), now)).toBeUndefined();
    expect(postingFromHtml(page('{"@type":"JobPosting","datePosted":"last week"}'), now)).toBeUndefined();
  });
});
