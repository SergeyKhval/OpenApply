import { describe, expect, it } from "vitest";
import { isSectionHeading, lockLines, segmentResume } from "../tailorSegment";
import { RESUME } from "./tailorFixtures";

const byText = (lines: ReturnType<typeof segmentResume>, start: string) =>
  lines.find((line) => line.text.startsWith(start))!;

describe("segmentResume", () => {
  const lines = segmentResume(RESUME);

  it("numbers lines and drops page markers", () => {
    expect(lines[0]).toMatchObject({ id: "L1", text: "Sarah Chen" });
    expect(lines.some((line) => line.text.includes("1 of 2"))).toBe(false);
  });

  it("merges a soft-wrapped continuation into its bullet", () => {
    expect(byText(lines, "Integrated REST").text).toBe(
      "Integrated REST APIs for billing and search, handling pagination and error states.",
    );
  });

  it("locks the top block, job headers and dates, and education", () => {
    expect(byText(lines, "Sarah Chen").role).toBe("locked");
    expect(byText(lines, "sarah.chen@").role).toBe("locked");
    expect(byText(lines, "Mar 2019").role).toBe("locked");
    expect(byText(lines, "2016 – 2019").role).toBe("locked");
    expect(byText(lines, "B.S. Computer Science").role).toBe("locked");
  });

  it("marks section headings and editable bullets", () => {
    expect(byText(lines, "Experience").role).toBe("heading");
    expect(byText(lines, "Skills").role).toBe("heading");
    expect(byText(lines, "Built the core").role).toBe("bullet");
    expect(byText(lines, "Built the core").bullet).toBe(true);
  });

  it("owns each bullet by the nearest header above it in source order", () => {
    const northwindDates = byText(lines, "Mar 2019");
    const acmeDates = byText(lines, "2016 – 2019");
    expect(byText(lines, "Built the core").owner).toBe(northwindDates.id);
    expect(byText(lines, "Mentored two").owner).toBe(acmeDates.id);
  });

  it("keeps a bullet with a year editable", () => {
    const resume = "Name\nExperience\nEngineer, Co\n2020 – 2022\n• Shipped the 2021 redesign to all users on time and under budget.";
    expect(byText(segmentResume(resume), "Shipped").role).toBe("bullet");
  });
});

describe("lockLines", () => {
  it("locks model-declared headers and re-derives owners", () => {
    const lines = segmentResume("Name\nExperience\n• Engineer, Co\n• Did a thing\n• Did another");
    const locked = lockLines(lines, ["L3"]);
    expect(locked[2].role).toBe("locked");
    expect(locked[3].owner).toBe("L3");
  });

  it("never unlocks a heading or turns it into a lock", () => {
    const lines = segmentResume("Name\nSkills\nReact");
    expect(lockLines(lines, ["L2"])[1].role).toBe("heading");
  });
});

describe("isSectionHeading", () => {
  it.each(["EXPERIENCE", "Work Experience:", "Skills & Tools", "Licenses and Certifications"])("%s", (text) => {
    expect(isSectionHeading(text)).toBe(true);
  });

  it("is not fooled by a sentence", () => {
    expect(isSectionHeading("Experience with React and Vue")).toBe(false);
  });
});
