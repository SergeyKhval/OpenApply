import { describe, expect, it } from "vitest";
import type { Contact, Interview, JobApplication, JobApplicationNote } from "@/types";
import { buildTimeline } from "../timeline";

const NOW = new Date(2026, 8, 25, 10);
const day = (offset: number, hour = 9) => new Date(2026, 8, 25 + offset, hour);
const ts = (date: Date) => ({ toDate: () => date });

const job = (fields: Record<string, unknown>) =>
  ({ id: "j", companyName: "Northwind Labs", position: "Engineer", createdAt: ts(day(-9)), ...fields }) as unknown as JobApplication;
const note = (id: string, when: Date | null, text = "A note") =>
  ({ id, text, createdAt: when && ts(when) }) as unknown as JobApplicationNote;
const interview = (id: string, when: Date, status: Interview["status"] = "pending") =>
  ({ id, name: "Tech screen", status, conductedAt: ts(when) }) as unknown as Interview;
const contact = (id: string, when: Date) =>
  ({ id, firstName: "Dana", lastName: "Ruiz", position: "Engineering Manager", email: "dana@example.com", linkedInUrl: "", createdAt: ts(when) }) as unknown as Contact;

describe("buildTimeline", () => {
  it("merges notes, interviews, contacts and stage changes, newest first", () => {
    const entries = buildTimeline(
      {
        job: job({ status: "interviewing", appliedAt: ts(day(-8)), interviewedAt: ts(day(-3)) }),
        notes: [note("n1", day(-1))],
        interviews: [interview("i1", day(-2))],
        contacts: [contact("c1", day(-2, 8))],
      },
      NOW,
    );
    expect(entries.map((entry) => `${entry.kind}:${entry.title}`)).toEqual([
      "note:Note",
      "interview:Tech screen",
      "contact:Dana Ruiz",
      "stage:Moved to Interviewing",
      "stage:Applied",
      "stage:Saved",
    ]);
  });

  it("puts upcoming interviews on top, soonest first, and marks them", () => {
    const entries = buildTimeline(
      {
        job: job({ status: "interviewing" }),
        notes: [note("n1", day(-1))],
        interviews: [interview("later", day(5)), interview("soon", day(1)), interview("past", day(-4), "passed")],
        contacts: [],
      },
      NOW,
    );
    expect(entries.slice(0, 2).map((entry) => [entry.id, entry.upcoming])).toEqual([
      ["soon", true],
      ["later", true],
    ]);
    expect(entries.find((entry) => entry.id === "past")?.upcoming).toBe(false);
  });

  it("shows a just-added note (no server time yet) at the top", () => {
    const entries = buildTimeline(
      { job: job({ status: "draft" }), notes: [note("fresh", null), note("old", day(-5))], interviews: [], contacts: [] },
      NOW,
    );
    expect(entries[0].id).toBe("fresh");
  });

  it("logs closing with the reason", () => {
    const entries = buildTimeline(
      { job: job({ status: "rejected", appliedAt: ts(day(-8)), updatedAt: ts(day(-1)) }), notes: [], interviews: [], contacts: [] },
      NOW,
    );
    expect(entries[0]).toMatchObject({ kind: "stage", title: "Closed as Rejected" });
  });

  it("skips stage dates that were cleared", () => {
    const entries = buildTimeline(
      { job: job({ status: "applied", appliedAt: ts(day(-2)), offeredAt: null, hiredAt: null }), notes: [], interviews: [], contacts: [] },
      NOW,
    );
    expect(entries.map((entry) => entry.title)).toEqual(["Applied", "Saved"]);
  });

  it("keeps stage changes in lifecycle order when they share a timestamp", () => {
    const sameMoment = day(-5);
    const entries = buildTimeline(
      { job: job({ status: "applied", createdAt: ts(sameMoment), appliedAt: ts(sameMoment) }), notes: [], interviews: [], contacts: [] },
      NOW,
    );
    expect(entries.map((entry) => entry.title)).toEqual(["Applied", "Saved"]);
  });
});
