import { describe, expect, it } from "vitest";
import {
  contactHints,
  entryHints,
  missingSectionTypes,
  moveInPlace,
  newEducation,
  newRole,
  newSection,
  removeAt,
  undoRemove,
} from "../builtResumeEdit";
import { SECTION_HEADINGS, emptyStructuredResume, serializeResume } from "../builtResume";

describe("newSection", () => {
  it("starts role sections with one empty role and item sections empty", () => {
    expect(newSection("experience", "s1")).toMatchObject({ id: "s1", type: "experience", heading: "Experience", entries: [{ title: "" }] });
    expect(newSection("education", "s2")).toMatchObject({ type: "education", heading: "Education", entries: [{ degree: "" }] });
    expect(newSection("skills", "s3")).toEqual({ id: "s3", type: "skills", heading: "Skills", items: [] });
    expect(newSection("summary", "s4")).toEqual({ id: "s4", type: "summary", heading: "Summary", text: "" });
  });

  it("uses each section's default heading, which tailoring recognizes", () => {
    for (const type of ["summary", "experience", "education", "skills", "projects", "certifications", "languages", "volunteering", "awards"] as const) {
      expect(newSection(type).heading, type).toBe(SECTION_HEADINGS[type][0]);
    }
  });

  it("adds nothing to the text until something is typed", () => {
    const resume = emptyStructuredResume({ name: "Sarah Chen" });
    resume.sections.push(newSection("projects"), newSection("summary"));
    expect(serializeResume(resume)).toBe("Sarah Chen");
  });
});

describe("missingSectionTypes", () => {
  it("lists the types not on the resume yet, in menu order", () => {
    const resume = emptyStructuredResume();
    expect(missingSectionTypes(resume)).toEqual(["summary", "projects", "certifications", "languages", "volunteering", "awards"]);
  });
});

describe("moveInPlace", () => {
  it("moves up and down within bounds", () => {
    const list = ["a", "b", "c"];
    expect(moveInPlace(list, 1, -1)).toBe(0);
    expect(list).toEqual(["b", "a", "c"]);
    expect(moveInPlace(list, 0, 1)).toBe(1);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("stays put at the ends", () => {
    const list = ["a", "b"];
    expect(moveInPlace(list, 0, -1)).toBe(0);
    expect(moveInPlace(list, 1, 1)).toBe(1);
    expect(list).toEqual(["a", "b"]);
  });
});

describe("removeAt and undoRemove", () => {
  it("puts the item back where it was", () => {
    const list = ["a", "b", "c"];
    const removed = removeAt(list, 1)!;
    expect(list).toEqual(["a", "c"]);
    undoRemove(removed);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("returns null for a missing index", () => {
    expect(removeAt(["a"], 3)).toBeNull();
  });
});

describe("entryHints", () => {
  it("says nothing about an untouched entry", () => {
    expect(entryHints(newRole(), false)).toEqual([]);
  });

  it("asks for dates and a line on what you did", () => {
    const role = { ...newRole(), title: "Analyst", bullets: [] };
    expect(entryHints(role, false)).toEqual([
      "Add dates, so recruiters and ATS see when this was.",
      "Add a line or two on what you did here.",
    ]);
  });

  it("doesn't ask education for bullets, and flags a long line", () => {
    const school = { ...newEducation(), degree: "BSc", start: { year: 2014, month: null } };
    expect(entryHints(school, true)).toEqual([]);
    const role = { ...newRole(), title: "Analyst", end: "present" as const, bullets: [{ id: "b", text: "x".repeat(221) }] };
    expect(entryHints(role, false)).toEqual(["One of these lines runs past two lines on the page. Shorter reads better."]);
  });
});

describe("contactHints", () => {
  const contact = { name: "Sarah Chen", headline: "", email: "sarah@example.com", phone: "", location: "", links: [] };

  it("says nothing when there's a name and an email", () => {
    expect(contactHints(contact)).toEqual([]);
  });

  it("asks for a name and an email", () => {
    expect(contactHints({ ...contact, name: " ", email: "" })).toEqual([
      "Add your name, it's the first line recruiters read.",
      "Add an email, so recruiters can reach you.",
    ]);
  });
});
