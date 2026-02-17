import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockAdd = vi.fn();
const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockCollection = vi.fn().mockReturnValue({ where: mockWhere, add: mockAdd });

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
  FieldValue: {
    serverTimestamp: () => "mock-timestamp",
  },
}));

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    HttpsError,
    onCall: (fn: Function) => fn,
  };
});

import { jobs } from "../jobs";

describe("jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue({ where: mockWhere, add: mockAdd });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ get: mockGet });
  });

  const callJobs = (data: unknown) =>
    (jobs as unknown as Function)({ data });

  it("rejects missing URL", async () => {
    await expect(callJobs({})).rejects.toThrow("Missing or invalid URL");
  });

  it("rejects non-string URL", async () => {
    await expect(callJobs({ url: 123 })).rejects.toThrow(
      "Missing or invalid URL",
    );
  });

  it("rejects null data", async () => {
    await expect(callJobs(null)).rejects.toThrow("Missing or invalid URL");
  });

  it("rejects malformed URL format", async () => {
    await expect(callJobs({ url: "not-a-url" })).rejects.toThrow(
      "Invalid URL format",
    );
  });

  it("rejects ftp URL", async () => {
    await expect(callJobs({ url: "ftp://example.com" })).rejects.toThrow(
      "Invalid URL format",
    );
  });

  it("returns existing doc id for duplicate URLs", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "existing-doc-id" }],
    });

    const result = await callJobs({ url: "https://example.com/job" });
    expect(result).toEqual({ id: "existing-doc-id" });
  });

  it("creates new doc for fresh URLs", async () => {
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockAdd.mockResolvedValueOnce({ id: "new-doc-id" });

    const result = await callJobs({ url: "https://example.com/new-job" });
    expect(result).toEqual({ id: "new-doc-id" });
    expect(mockAdd).toHaveBeenCalledWith({
      jobDescriptionLink: "https://example.com/new-job",
      status: "pending",
      createdAt: "mock-timestamp",
    });
  });
});
