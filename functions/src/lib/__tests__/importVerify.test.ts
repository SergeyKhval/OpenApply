import { describe, expect, it } from "vitest";
import { segmentResume } from "../tailorSegment";
import {
  fallbackImport,
  findVerbatim,
  headingType,
  isMostlyTaken,
  matchHeading,
  verifyImport,
  type Cited,
  type CitedDate,
  type ImportProposal,
  type ProposedEntry,
} from "../importVerify";
import type { ResumeRole, StructuredResume } from "../builtResume";

const RESUME = `Maya Chen
Frontend Engineer
maya.chen@example.com | +48 600 100 200 | linkedin.com/in/mayachen
Summary
Frontend engineer who likes boring, fast checkouts.
Experience
Senior Frontend Engineer, Globex | Warsaw | Mar 2021 – Present
• Cut checkout load time from 4.1 s to 1.6 s.
• Helped migrate the design system to Vue 3.
Frontend Engineer, Initech | Krakow | 2018 – 2021
• Built the invoice list used by 300 accountants.
Education
BSc Computer Science, Warsaw University of Technology | 2014 – 2018
Skills
TypeScript, Vue, Google Cloud, PostgreSQL
Interests
Climbing`;

const lines = segmentResume(RESUME);
const idOf = (text: string) => {
  const line = lines.find((candidate) => candidate.text.startsWith(text));
  if (!line) throw new Error(`no line ${text}`);
  return line.id;
};

const cite = (text: string, lineStart: string): Cited => ({ text, lineId: idOf(lineStart) });
const none: Cited = { text: "", lineId: "" };
const noDate: CitedDate = { year: 0, month: 0, lineId: "" };
const dateOn = (year: number, month: number, lineStart: string): CitedDate => ({ year, month, lineId: idOf(lineStart) });

const globex = (): ProposedEntry => ({
  headerLineIds: [idOf("Senior Frontend Engineer")],
  title: cite("Senior Frontend Engineer", "Senior Frontend Engineer"),
  organization: cite("Globex", "Senior Frontend Engineer"),
  location: cite("Warsaw", "Senior Frontend Engineer"),
  start: dateOn(2021, 3, "Senior Frontend Engineer"),
  end: noDate,
  endIsPresent: true,
  bulletLineIds: [idOf("Cut checkout"), idOf("Helped migrate")],
});

const initech = (): ProposedEntry => ({
  headerLineIds: [idOf("Frontend Engineer, Initech")],
  title: cite("Frontend Engineer", "Frontend Engineer, Initech"),
  organization: cite("Initech", "Frontend Engineer, Initech"),
  location: cite("Krakow", "Frontend Engineer, Initech"),
  start: dateOn(2018, 0, "Frontend Engineer, Initech"),
  end: dateOn(2021, 0, "Frontend Engineer, Initech"),
  endIsPresent: false,
  bulletLineIds: [idOf("Built the invoice")],
});

function proposal(overrides: { entries?: ProposedEntry[]; contact?: Partial<ImportProposal["contact"]>; items?: Cited[] } = {}): ImportProposal {
  return {
    contact: {
      name: cite("Maya Chen", "Maya Chen"),
      headline: cite("Frontend Engineer", "Frontend Engineer"),
      email: cite("maya.chen@example.com", "maya.chen@"),
      phone: cite("+48 600 100 200", "maya.chen@"),
      location: none,
      links: [cite("linkedin.com/in/mayachen", "maya.chen@")],
      ...overrides.contact,
    },
    sections: [
      { type: "summary", headingLineId: idOf("Summary"), summaryLineIds: [idOf("Frontend engineer who")], items: [], entries: [] },
      { type: "experience", headingLineId: idOf("Experience"), summaryLineIds: [], items: [], entries: overrides.entries ?? [globex(), initech()] },
      {
        type: "education",
        headingLineId: idOf("Education"),
        summaryLineIds: [],
        items: [],
        entries: [
          {
            headerLineIds: [idOf("BSc Computer Science")],
            title: cite("BSc Computer Science", "BSc Computer Science"),
            organization: cite("Warsaw University of Technology", "BSc Computer Science"),
            location: none,
            start: dateOn(2014, 0, "BSc Computer Science"),
            end: dateOn(2018, 0, "BSc Computer Science"),
            endIsPresent: false,
            bulletLineIds: [],
          },
        ],
      },
      {
        type: "skills",
        headingLineId: idOf("Skills"),
        summaryLineIds: [],
        items: overrides.items ?? ["TypeScript", "Vue", "Google Cloud", "PostgreSQL"].map((item) => cite(item, "TypeScript")),
        entries: [],
      },
    ],
  };
}

const sequentialIds = () => {
  let next = 0;
  return () => `id${next++}`;
};

const run = (value: ImportProposal) => verifyImport(lines, value, sequentialIds());
const roles = (structured: StructuredResume) =>
  structured.sections.flatMap((section) => ("entries" in section && section.type !== "education" ? (section.entries as ResumeRole[]) : []));

describe("findVerbatim", () => {
  it("returns the line's own spelling, ignoring case and spacing", () => {
    expect(findVerbatim("Senior Frontend Engineer, Globex | Warsaw", "globex")).toBe("Globex");
    expect(findVerbatim("Senior  Frontend   Engineer", "Senior Frontend Engineer")).toBe("Senior Frontend Engineer");
  });

  it("trims edge punctuation from the candidate", () => {
    expect(findVerbatim("Engineer, Globex | Warsaw", "Globex |")).toBe("Globex");
  });

  it("matches whole words only", () => {
    expect(findVerbatim("TypeScript, Google Cloud", "Go")).toBeNull();
    expect(findVerbatim("Go, Rust", "Go")).toBe("Go");
  });

  it("refuses anything the line doesn't say", () => {
    expect(findVerbatim("Senior Frontend Engineer, Globex", "Globex Inc.")).toBeNull();
    expect(findVerbatim("Frontend Engineer", "Front-end Engineer")).toBeNull();
    expect(findVerbatim("Frontend Engineer", "")).toBeNull();
  });
});

describe("verifyImport, a clean proposal", () => {
  const result = run(proposal());

  it("keeps every cited field in the source's spelling", () => {
    expect(result.structured.contact).toEqual({
      name: "Maya Chen",
      headline: "Frontend Engineer",
      email: "maya.chen@example.com",
      phone: "+48 600 100 200",
      location: "",
      links: ["linkedin.com/in/mayachen"],
    });
    expect(roles(result.structured)).toEqual([
      {
        id: "id2",
        title: "Senior Frontend Engineer",
        organization: "Globex",
        location: "Warsaw",
        start: { year: 2021, month: 3 },
        end: "present",
        bullets: [
          { id: "id3", text: "Cut checkout load time from 4.1 s to 1.6 s." },
          { id: "id4", text: "Helped migrate the design system to Vue 3." },
        ],
      },
      {
        id: "id5",
        title: "Frontend Engineer",
        organization: "Initech",
        location: "Krakow",
        start: { year: 2018, month: null },
        end: { year: 2021, month: null },
        bullets: [{ id: "id6", text: "Built the invoice list used by 300 accountants." }],
      },
    ]);
  });

  it("copies the summary from its lines and keeps items", () => {
    expect(result.structured.sections[0]).toEqual({
      id: "id0",
      type: "summary",
      heading: "Summary",
      text: "Frontend engineer who likes boring, fast checkouts.",
    });
    expect(result.structured.sections.at(-1)).toMatchObject({ type: "skills", items: ["TypeScript", "Vue", "Google Cloud", "PostgreSQL"] });
  });

  it("flags nothing and lists the lines nothing used", () => {
    expect(result.flaggedFields).toEqual([]);
    expect(result.unsorted).toEqual([]);
    expect(result.notImported).toEqual(["Interests", "Climbing"]);
    expect(result.stats).toMatchObject({ sections: 4, entries: 3, bulletsImported: 3, bulletsUnsorted: 0, fieldsFlagged: 0 });
  });
});

describe("verifyImport, what the check throws out", () => {
  it("empties and flags a reworded title or an employer the header doesn't name", () => {
    const entry = globex();
    entry.title = cite("Sr. Front-end Developer", "Senior Frontend Engineer");
    entry.organization = cite("Globex Corporation", "Senior Frontend Engineer");
    const [role] = roles(run(proposal({ entries: [entry] })).structured);
    expect(role).toMatchObject({ title: "", organization: "" });
    expect(run(proposal({ entries: [entry] })).flaggedFields).toEqual(["sections.id1.entries.id2.title", "sections.id1.entries.id2.organization"]);
  });

  it("refuses a field cited to a line outside the entry's header", () => {
    const entry = globex();
    // "Vue 3" is in a bullet, not the header
    entry.title = cite("Vue", "Helped migrate");
    const result = run(proposal({ entries: [entry] }));
    expect(roles(result.structured)[0]!.title).toBe("");
    expect(result.flaggedFields).toContain("sections.id1.entries.id2.title");
  });

  it("refuses a year the line doesn't show and drops a month it doesn't show", () => {
    const entry = initech();
    entry.start = dateOn(2017, 0, "Frontend Engineer, Initech");
    entry.end = dateOn(2021, 6, "Frontend Engineer, Initech");
    const result = run(proposal({ entries: [entry] }));
    expect(roles(result.structured)[0]).toMatchObject({ start: null, end: { year: 2021, month: null } });
    expect(result.flaggedFields).toEqual(["sections.id1.entries.id2.start"]);
  });

  it("refuses 'present' when no header line says so", () => {
    const entry = initech();
    entry.endIsPresent = true;
    const result = run(proposal({ entries: [entry] }));
    expect(roles(result.structured)[0]!.end).toBeNull();
    expect(result.flaggedFields).toEqual(["sections.id1.entries.id2.end"]);
  });

  it("never puts another job's bullet under this one", () => {
    const entry = globex();
    entry.bulletLineIds = [idOf("Cut checkout"), idOf("Built the invoice")];
    const result = run(proposal({ entries: [entry, { ...initech(), bulletLineIds: [] }] }));
    expect(roles(result.structured)[0]!.bullets.map((bullet) => bullet.text)).toEqual(["Cut checkout load time from 4.1 s to 1.6 s."]);
    expect(result.unsorted).toEqual(["Built the invoice list used by 300 accountants."]);
  });

  it("won't let a bullet be declared a header to take over the bullets below it", () => {
    const fake: ProposedEntry = {
      ...globex(),
      headerLineIds: [idOf("Cut checkout")],
      title: cite("Cut checkout load time", "Cut checkout"),
      organization: none,
      location: none,
      start: noDate,
      endIsPresent: false,
      bulletLineIds: [idOf("Helped migrate")],
    };
    const result = run(proposal({ entries: [fake] }));
    expect(roles(result.structured)).toEqual([]);
    expect(result.unsorted).toEqual(["Helped migrate the design system to Vue 3."]);
  });

  it("lets two roles share an employer line, which then owns no bullet", () => {
    const text = `Experience
Initech
Frontend Engineer
Jun 2019 - Feb 2021
Built the invoice list.
Junior Developer
Jun 2018 - May 2019
Fixed signup bugs.`;
    const shared = segmentResume(text);
    const id = (start: string) => shared.find((line) => line.text.startsWith(start))!.id;
    const role = (title: string, dates: string, from: number, to: number, bullet: string): ProposedEntry => ({
      headerLineIds: [id("Initech"), id(title), id(dates)],
      title: { text: title, lineId: id(title) },
      organization: { text: "Initech", lineId: id("Initech") },
      location: none,
      start: { year: from, month: 6, lineId: id(dates) },
      end: { year: to, month: 0, lineId: id(dates) },
      endIsPresent: false,
      bulletLineIds: [id(bullet)],
    });
    const result = verifyImport(
      shared,
      {
        contact: { name: none, headline: none, email: none, phone: none, location: none, links: [] },
        sections: [
          {
            type: "experience",
            headingLineId: id("Experience"),
            summaryLineIds: [],
            items: [],
            entries: [role("Frontend Engineer", "Jun 2019", 2019, 2021, "Built"), role("Junior Developer", "Jun 2018", 2018, 2019, "Fixed")],
          },
        ],
      },
      sequentialIds(),
    );
    expect(roles(result.structured).map((entry) => [entry.title, entry.organization, entry.bullets.map((bullet) => bullet.text)])).toEqual([
      ["Frontend Engineer", "Initech", ["Built the invoice list."]],
      ["Junior Developer", "Initech", ["Fixed signup bugs."]],
    ]);
    expect(result.flaggedFields).toEqual([]);
  });

  it("ignores unknown ids, headings as bullets and a bullet used twice", () => {
    const entry = globex();
    entry.bulletLineIds = ["L999", idOf("Experience"), idOf("Cut checkout"), idOf("Cut checkout")];
    const result = run(proposal({ entries: [entry] }));
    expect(roles(result.structured)[0]!.bullets.map((bullet) => bullet.text)).toEqual(["Cut checkout load time from 4.1 s to 1.6 s."]);
  });

  it("drops an email with no @ and a link the line doesn't have", () => {
    const result = run(
      proposal({
        contact: { email: cite("600 100 200", "maya.chen@"), links: [cite("github.com/mayachen", "maya.chen@")] },
      }),
    );
    expect(result.structured.contact.email).toBe("");
    expect(result.structured.contact.links).toEqual([]);
    expect(result.flaggedFields).toEqual(["contact.links.0", "contact.email"]);
  });

  it("keeps only items the line lists", () => {
    const result = run(proposal({ items: [cite("TypeScript", "TypeScript"), cite("Go", "TypeScript"), cite("Kubernetes", "TypeScript")] }));
    expect(result.structured.sections.at(-1)).toMatchObject({ type: "skills", items: ["TypeScript"] });
    expect(result.flaggedFields).toHaveLength(2);
  });

  it("drops an entry with nothing left", () => {
    const empty: ProposedEntry = {
      headerLineIds: ["L999"],
      title: cite("Staff Engineer", "Senior Frontend Engineer"),
      organization: none,
      location: none,
      start: noDate,
      end: noDate,
      endIsPresent: false,
      bulletLineIds: [],
    };
    const result = run(proposal({ entries: [empty, initech()] }));
    expect(roles(result.structured).map((role) => role.organization)).toEqual(["Initech"]);
  });
});

describe("lines only partly imported", () => {
  it("counts a header whose fields cover it as imported", () => {
    expect(isMostlyTaken("Senior Frontend Engineer, Globex | Warsaw | Mar 2021 – Present", ["Senior Frontend Engineer", "Globex", "Warsaw", "2021", "mar", "Present"])).toBe(true);
    expect(isMostlyTaken("Brightdesk · Full-time", ["Brightdesk"])).toBe(true);
  });

  it("doesn't count a wall of text that only gave a title", () => {
    expect(isMostlyTaken("Full-Stack Engineer Dunmore Systems 2023-2026 built React frontend features and Express/Node backend APIs", ["Full-Stack Engineer", "Dunmore Systems", "2023"])).toBe(false);
    expect(isMostlyTaken("Anything", [])).toBe(false);
  });

  it("lists a header line that fields barely cover, so its text isn't lost", () => {
    const text = `Experience
Engineer, Acme | 2020 – 2024 | built the billing service and ran on-call for the payments team for four years
• Wrote the runbook.`;
    const wall = segmentResume(text);
    const header = wall[1]!;
    const result = verifyImport(
      wall,
      {
        contact: { name: none, headline: none, email: none, phone: none, location: none, links: [] },
        sections: [
          {
            type: "experience",
            headingLineId: wall[0]!.id,
            summaryLineIds: [],
            items: [],
            entries: [
              {
                headerLineIds: [header.id],
                title: { text: "Engineer", lineId: header.id },
                organization: { text: "Acme", lineId: header.id },
                location: none,
                start: { year: 2020, month: 0, lineId: header.id },
                end: { year: 2024, month: 0, lineId: header.id },
                endIsPresent: false,
                bulletLineIds: [wall[2]!.id],
              },
            ],
          },
        ],
      },
      sequentialIds(),
    );
    expect(roles(result.structured)[0]).toMatchObject({ title: "Engineer", organization: "Acme", bullets: [{ text: "Wrote the runbook." }] });
    expect(result.notImported).toEqual([header.text]);
  });
});

describe("matchHeading and headingType", () => {
  it("keeps a source heading the section allows, else uses the default", () => {
    expect(matchHeading("experience", "WORK EXPERIENCE:")).toBe("Work Experience");
    expect(matchHeading("experience", "Career")).toBe("Experience");
    expect(matchHeading("education", "Education & Training")).toBe("Education and Training");
  });

  it("types common headings", () => {
    expect(headingType("Volunteer Experience")).toBe("volunteering");
    expect(headingType("Professional Experience")).toBe("experience");
    expect(headingType("Technical Skills")).toBe("skills");
    expect(headingType("Licenses & Certifications")).toBe("certifications");
    expect(headingType("Interests")).toBeNull();
  });
});

describe("fallbackImport", () => {
  const result = fallbackImport(lines, sequentialIds());

  it("takes contact details from the top block", () => {
    expect(result.structured.contact).toEqual({
      name: "Maya Chen",
      headline: "Frontend Engineer",
      email: "maya.chen@example.com",
      phone: "+48 600 100 200",
      location: "",
      links: ["linkedin.com/in/mayachen"],
    });
  });

  it("keeps bullets under their own header line and flags unsplit headers", () => {
    const [first, second] = roles(result.structured);
    expect(first).toMatchObject({ title: "Senior Frontend Engineer, Globex | Warsaw | Mar 2021 – Present", organization: "", start: null });
    expect(first!.bullets).toHaveLength(2);
    expect(second!.bullets.map((bullet) => bullet.text)).toEqual(["Built the invoice list used by 300 accountants."]);
    expect(result.flaggedFields).toHaveLength(3);
  });

  it("splits a comma-separated skills line and skips unknown sections", () => {
    expect(result.structured.sections.at(-1)).toMatchObject({ type: "skills", items: ["TypeScript", "Vue", "Google Cloud", "PostgreSQL"] });
    expect(result.notImported).toEqual(["Interests", "Climbing"]);
  });

  it("only ever uses whole source lines or matches inside them", () => {
    const sourceText = lines.map((line) => line.text).join("\n");
    const values = JSON.stringify(result.structured).match(/"(?:text|title|degree|name|headline|email|phone)":"([^"]+)"/g) ?? [];
    for (const value of values) {
      const text = value.slice(value.indexOf(":") + 2, -1);
      expect(sourceText, text).toContain(text);
    }
  });
});
