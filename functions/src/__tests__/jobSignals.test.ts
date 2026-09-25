import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({}),
  FieldValue: { serverTimestamp: () => "mock-timestamp" },
}));
vi.mock("firebase-functions/v2/firestore", () => ({ onDocumentWritten: (_: unknown, fn: unknown) => fn }));

import { shouldRecordJobSignals } from "../jobSignals";

const application = {
  jobDescriptionLink: "https://job-boards.greenhouse.io/acme/jobs/1",
  posting: { postedAt: "2026-09-01", postedAtSource: "json-ld" },
  jobId: "job-1",
};

describe("shouldRecordJobSignals", () => {
  it("records a new application with a link", () => {
    expect(shouldRecordJobSignals(undefined, application)).toBe(true);
  });

  it("skips deletions and applications without a link", () => {
    expect(shouldRecordJobSignals(application, undefined)).toBe(false);
    expect(shouldRecordJobSignals(undefined, { ...application, jobDescriptionLink: undefined })).toBe(false);
    expect(shouldRecordJobSignals(undefined, { ...application, jobDescriptionLink: "" })).toBe(false);
  });

  it("records when the link, posting or cached job changes", () => {
    const recorded = { ...application, jobKeyHash: "abc" };
    expect(shouldRecordJobSignals(recorded, { ...recorded, jobDescriptionLink: "https://jobs.lever.co/acme/x" })).toBe(true);
    expect(shouldRecordJobSignals(recorded, { ...recorded, posting: { postedAt: "2026-09-02", postedAtSource: "json-ld" } })).toBe(true);
    expect(shouldRecordJobSignals(recorded, { ...recorded, jobId: "job-2" })).toBe(true);
  });

  it("skips its own jobKeyHash write and unrelated edits once recorded", () => {
    expect(shouldRecordJobSignals(application, { ...application, jobKeyHash: "abc" })).toBe(false);
    const recorded = { ...application, jobKeyHash: "abc" };
    expect(shouldRecordJobSignals(recorded, { ...recorded, status: "applied" })).toBe(false);
  });

  it("records older applications on their next edit, once", () => {
    expect(shouldRecordJobSignals(application, { ...application, status: "applied" })).toBe(true);
  });
});
