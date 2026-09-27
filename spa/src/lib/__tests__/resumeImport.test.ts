import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_PDF_BYTES,
  checkImportFile,
  entryTargets,
  importErrorMessage,
  isFlagged,
  pendingUnsorted,
  placeLine,
} from "../resumeImport";
import type { StructuredResume } from "../builtResume";

const resume = (): StructuredResume => ({
  version: 1,
  contact: { name: "Sarah Chen", headline: "", email: "", phone: "", location: "", links: [] },
  sections: [
    {
      id: "s1",
      type: "experience",
      heading: "Experience",
      entries: [
        {
          id: "e1",
          title: "Engineer",
          organization: "Globex",
          location: "",
          start: null,
          end: null,
          bullets: [{ id: "b1", text: "Cut load time by half" }],
        },
        { id: "e2", title: "", organization: "Initech", location: "", start: null, end: null, bullets: [] },
      ],
    },
    { id: "s2", type: "education", heading: "Education", entries: [{ id: "e3", degree: "BSc", school: "", location: "", start: null, end: null, bullets: [] }] },
    { id: "s3", type: "skills", heading: "Skills", items: ["Vue"] },
  ],
});

describe("isFlagged", () => {
  const flagged = new Set(["contact.email", "contact.links.0", "sections.s1.entries.e1.start"]);

  it("marks a flagged field while it's still empty", () => {
    expect(isFlagged(flagged, "contact.email", "")).toBe(true);
    expect(isFlagged(flagged, "sections.s1.entries.e1.start", null)).toBe(true);
  });

  it("clears once the user fills it in", () => {
    expect(isFlagged(flagged, "contact.email", "sarah@example.com")).toBe(false);
    expect(isFlagged(flagged, "sections.s1.entries.e1.start", { year: 2021, month: null })).toBe(false);
  });

  it("never marks a field the import didn't flag", () => {
    expect(isFlagged(flagged, "contact.phone", "")).toBe(false);
  });

  it("marks links as a group, by prefix, while there are none", () => {
    expect(isFlagged(flagged, "contact.links", [])).toBe(true);
    expect(isFlagged(flagged, "contact.links", ["linkedin.com/in/sarah"])).toBe(false);
  });
});

describe("pendingUnsorted", () => {
  it("drops lines the user has since placed, ignoring spacing and case", () => {
    expect(pendingUnsorted(["• cut load time  by half", "Shipped the app"], resume())).toEqual(["Shipped the app"]);
  });

  it("is empty without an import", () => {
    expect(pendingUnsorted(undefined, resume())).toEqual([]);
  });
});

describe("entryTargets and placeLine", () => {
  it("lists every entry by name, with a fallback for an unnamed one", () => {
    expect(entryTargets(resume())).toEqual([
      { sectionId: "s1", entryId: "e1", label: "Engineer, Globex" },
      { sectionId: "s1", entryId: "e2", label: "Initech" },
      { sectionId: "s2", entryId: "e3", label: "BSc" },
    ]);
  });

  it("adds a line to the chosen entry, without its bullet glyph", () => {
    const structured = resume();
    placeLine(structured, "• Shipped the app", { sectionId: "s1", entryId: "e2" }, () => "new");
    const section = structured.sections[0]!;
    expect("entries" in section && section.entries[1]!.bullets).toEqual([{ id: "new", text: "Shipped the app" }]);
  });
});

describe("checkImportFile", () => {
  it("takes a PDF under the size cap", () => {
    expect(checkImportFile({ name: "Profile.pdf", type: "application/pdf", size: 1000 })).toBeNull();
  });

  it("turns down other files and big ones", () => {
    expect(checkImportFile({ name: "Profile.docx", type: "application/msword", size: 1000 })).toBe("That file isn't a PDF.");
    expect(checkImportFile({ name: "Profile.pdf", type: "application/pdf", size: MAX_IMPORT_PDF_BYTES + 1 })).toBe(
      "That PDF is too big. LinkedIn's own export is well under 5 MB.",
    );
  });
});

describe("importErrorMessage", () => {
  it("passes on the callable's own message for the errors it explains", () => {
    const error = { code: "functions/failed-precondition", message: "There's too little text here to build a resume from.", details: { code: "too_short" } };
    expect(importErrorMessage(error)).toEqual({ message: "There's too little text here to build a resume from.", code: "too_short" });
  });

  it("passes on the rate limit message, coded by its HTTP code", () => {
    expect(importErrorMessage({ code: "functions/resource-exhausted", message: "Resume imports are busy today." })).toEqual({
      message: "Resume imports are busy today.",
      code: "resource-exhausted",
    });
  });

  it("doesn't show a raw network error", () => {
    expect(importErrorMessage({ code: "functions/deadline-exceeded", message: "deadline-exceeded" })).toEqual({
      message: "Something went wrong while importing. Try again in a moment.",
      code: "deadline-exceeded",
    });
  });

  it("falls back to a plain message", () => {
    expect(importErrorMessage(new Error("network"))).toEqual({
      message: "Something went wrong while importing. Try again in a moment.",
      code: "unknown",
    });
  });
});
