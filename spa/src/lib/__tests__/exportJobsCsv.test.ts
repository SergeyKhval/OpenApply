import { describe, expect, it } from "vitest";
import type { JobApplication } from "@/types";
import { jobsToCsv } from "../exportJobsCsv";

const ts = (date: Date) => ({ toDate: () => date });
const job = (fields: Record<string, unknown>) =>
  ({
    id: "j1",
    companyName: "Northwind Labs",
    position: "Senior Frontend Engineer",
    status: "applied",
    jobDescriptionLink: "https://careers.example.com/1",
    remotePolicy: "hybrid",
    createdAt: ts(new Date(2026, 8, 16, 12)),
    appliedAt: ts(new Date(2026, 8, 17, 12)),
    followUpAt: ts(new Date(2026, 8, 24, 0)),
    ...fields,
  }) as unknown as JobApplication;

const lines = (csv: string) => csv.split("\r\n");

describe("jobsToCsv", () => {
  it("has a header and one row per job with stage names and ISO dates", () => {
    const csv = jobsToCsv([job({})], new Map([["j1", ["Ask about on-call", "Recruiter: Dana"]]]));
    expect(lines(csv)[0]).toBe("Company,Role,Stage,Closed reason,Work,Link,Saved,Applied,Follow up,Notes");
    expect(lines(csv)[1]).toBe(
      "Northwind Labs,Senior Frontend Engineer,Applied,,hybrid,https://careers.example.com/1,2026-09-16,2026-09-17,2026-09-24,Ask about on-call | Recruiter: Dana",
    );
  });

  it("quotes commas, quotes and line breaks", () => {
    const csv = jobsToCsv([job({ companyName: 'Acme, "Inc"', position: "Line one\nline two" })], new Map());
    expect(lines(csv)[1].startsWith('"Acme, ""Inc""","Line one\nline two"')).toBe(true);
  });

  it("neutralizes values a spreadsheet would run as formulas", () => {
    const csv = jobsToCsv([job({ companyName: "=HYPERLINK(\"http://x\")", position: "+1 role" })], new Map());
    expect(lines(csv)[1].startsWith(`"'=HYPERLINK(""http://x"")",'+1 role`)).toBe(true);
  });

  it("shows closed jobs with their reason and leaves missing dates empty", () => {
    const csv = jobsToCsv([job({ status: "rejected", appliedAt: null, followUpAt: undefined })], new Map());
    expect(lines(csv)[1]).toContain(",Closed,Rejected,");
    expect(lines(csv)[1]).toContain(",2026-09-16,,,");
  });
});
