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

  it("looks up the canonical URL and the link as given", async () => {
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "existing-doc-id" }] });

    const result = await callJobs({
      url: "https://zoolatech.com/vacancies/qa-216414-1.html#block-id-forms-join-our-team",
    });
    expect(result).toEqual({ id: "existing-doc-id" });
    expect(mockWhere).toHaveBeenCalledWith("jobDescriptionLink", "in", [
      "https://zoolatech.com/vacancies/qa-216414-1.html",
      "https://zoolatech.com/vacancies/qa-216414-1.html#block-id-forms-join-our-team",
    ]);
  });

  it("caches new jobs under the canonical URL", async () => {
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockAdd.mockResolvedValueOnce({ id: "new-doc-id" });

    await callJobs({ url: "https://example.com/job?utm_source=reddit#apply" });
    expect(mockWhere).toHaveBeenCalledWith("jobDescriptionLink", "in", [
      "https://example.com/job",
      "https://example.com/job?utm_source=reddit#apply",
    ]);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ jobDescriptionLink: "https://example.com/job" }),
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

  describe("pasted descriptions", () => {
    const description = "Senior Frontend Engineer at Acme. ".repeat(10);

    it("creates a doc ready for the parser, skipping the scrape and the link cache", async () => {
      mockAdd.mockResolvedValueOnce({ id: "pasted-doc-id" });

      const result = await callJobs({ text: `  ${description}  ` });
      expect(result).toEqual({ id: "pasted-doc-id" });
      expect(mockWhere).not.toHaveBeenCalled();
      expect(mockAdd).toHaveBeenCalledWith({
        source: "paste",
        status: "scrapped",
        content: description.trim(),
        createdAt: "mock-timestamp",
      });
    });

    it("keeps the posting's canonical link outside the cached field", async () => {
      mockAdd.mockResolvedValueOnce({ id: "pasted-doc-id" });

      await callJobs({
        text: description,
        url: "https://www.linkedin.com/jobs/view/senior-frontend-engineer-at-acme-4012345678/?trk=abc",
      });
      const saved = mockAdd.mock.calls[0]?.[0];
      expect(saved.postingLink).toBe("https://www.linkedin.com/jobs/view/4012345678/");
      expect(saved).not.toHaveProperty("jobDescriptionLink");
    });

    it("rejects text too short to be a posting", async () => {
      await expect(callJobs({ text: "Frontend engineer" })).rejects.toThrow("too short");
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("rejects text past the size cap", async () => {
      await expect(callJobs({ text: "a".repeat(20001) })).rejects.toThrow("longer than any job description");
    });

    it("rejects an invalid link alongside the text", async () => {
      await expect(callJobs({ text: description, url: "linkedin" })).rejects.toThrow("Invalid URL format");
    });
  });
});
