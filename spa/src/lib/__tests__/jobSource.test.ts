import { describe, expect, it } from "vitest";
import { foundViaLabel } from "../jobSource";

describe("foundViaLabel", () => {
  it.each([
    ["https://www.linkedin.com/jobs/view/123", "LinkedIn"],
    ["https://boards.greenhouse.io/acme/jobs/1", "Greenhouse"],
    ["https://jobs.lever.co/acme/abc", "Lever"],
    ["https://acme.wd5.myworkdayjobs.com/en-US/careers/job/x", "Workday"],
    ["https://careers.northwind.example/roles/42", "northwind.example"],
    ["https://www.acme.com/jobs/1", "acme.com"],
  ])("%s is found via %s", (link, label) => {
    expect(foundViaLabel(link)).toBe(label);
  });

  it("is empty without a usable link", () => {
    expect(foundViaLabel(undefined)).toBe("");
    expect(foundViaLabel("")).toBe("");
    expect(foundViaLabel("not a url")).toBe("");
  });

  it("doesn't match a board's name inside another domain", () => {
    expect(foundViaLabel("https://notlinkedin.com/x")).toBe("notlinkedin.com");
  });
});
