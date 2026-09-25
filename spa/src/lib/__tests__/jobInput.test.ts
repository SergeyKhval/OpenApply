import { describe, expect, it } from "vitest";
import {
  MAX_DESCRIPTION_CHARS,
  asJobLink,
  blockedJobBoard,
  classifyJobInput,
  looksLikeDescription,
} from "../jobInput";

const DESCRIPTION = "We're hiring a Senior Frontend Engineer to build our design system.\n\n".repeat(4);

describe("asJobLink", () => {
  it.each([
    ["https://jobs.example.com/123", "https://jobs.example.com/123"],
    ["  http://example.com/job ", "http://example.com/job"],
    ["linkedin.com/jobs/view/4012345678", "https://linkedin.com/jobs/view/4012345678"],
    ["www.indeed.com/viewjob?jk=abc", "https://www.indeed.com/viewjob?jk=abc"],
  ])("reads %s as a link", (value, expected) => {
    expect(asJobLink(value)).toBe(expected);
  });

  it.each([
    ["empty", ""],
    ["a word", "engineer"],
    ["a sentence", "Senior engineer at example.com"],
    ["an ftp link", "ftp://example.com/job"],
  ])("rejects %s", (_label, value) => {
    expect(asJobLink(value)).toBeNull();
  });
});

describe("classifyJobInput", () => {
  it("tells links from descriptions", () => {
    expect(classifyJobInput("https://example.com/job")).toEqual({ kind: "link", url: "https://example.com/job" });
    expect(classifyJobInput(DESCRIPTION)).toEqual({ kind: "text", text: DESCRIPTION.trim() });
  });

  it("flags text too short to be a posting", () => {
    expect(classifyJobInput("Frontend engineer, remote")).toEqual({ kind: "too-short" });
    expect(classifyJobInput("   ")).toEqual({ kind: "empty" });
  });

  it("caps long descriptions", () => {
    const result = classifyJobInput("a ".repeat(MAX_DESCRIPTION_CHARS));
    expect(result.kind === "text" && result.text.length).toBe(MAX_DESCRIPTION_CHARS);
  });
});

describe("looksLikeDescription", () => {
  it("switches on multi-line or long pastes that aren't links", () => {
    expect(looksLikeDescription(DESCRIPTION)).toBe(true);
    expect(looksLikeDescription("About the role\nYou'll own onboarding")).toBe(true);
  });

  it("leaves links and short fragments alone", () => {
    expect(looksLikeDescription("https://example.com/a-very-long-path/that-goes-on-and-on/for-ever-and-ever-and-ever")).toBe(false);
    expect(looksLikeDescription("example")).toBe(false);
  });
});

describe("blockedJobBoard", () => {
  it.each([
    ["https://www.linkedin.com/jobs/view/4012345678/", "linkedin"],
    ["https://linkedin.com/jobs/collections/recommended/?currentJobId=1", "linkedin"],
    ["https://uk.indeed.com/viewjob?jk=abc", "indeed"],
    ["https://www.indeed.co.uk/viewjob?jk=abc", "indeed"],
  ])("recognizes %s", (url, board) => {
    expect(blockedJobBoard(url)).toBe(board);
  });

  it.each([
    "https://www.linkedin.com/company/acme/",
    "https://boards.greenhouse.io/acme/jobs/1",
    "https://notlinkedin.com/jobs/1",
    "not a url",
  ])("leaves %s to the scraper", (url) => {
    expect(blockedJobBoard(url)).toBeNull();
  });
});
