import { describe, it, expect, vi, beforeEach } from "vitest";
import { HOURLY_LIMIT_PER_CLIENT, DAILY_GLOBAL_LIMIT } from "../lib/jobsRateLimit";

const mockGet = vi.fn();
const mockAdd = vi.fn();
const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockTransactionGet = vi.fn();
const mockTransactionSet = vi.fn();
const mockCollection = vi.fn((name: string) => ({
  where: mockWhere,
  add: mockAdd,
  doc: (id: string) => ({ path: `${name}/${id}` }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (...args: unknown[]) => mockCollection(...(args as [string])),
    runTransaction: async (fn: (t: unknown) => Promise<void>) =>
      fn({ get: mockTransactionGet, set: mockTransactionSet }),
  }),
  FieldValue: {
    serverTimestamp: () => "mock-timestamp",
    increment: (n: number) => ({ __increment: n }),
  },
  Timestamp: {
    fromMillis: (ms: number) => ({ __millis: ms }),
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
    onCall: (optsOrFn: unknown, fn?: unknown) => fn ?? optsOrFn,
  };
});

vi.mock("firebase-functions", () => ({
  logger: { info: vi.fn() },
}));

import { jobs } from "../jobs";

describe("jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockImplementation((name: string) => ({
      where: mockWhere,
      add: mockAdd,
      doc: (id: string) => ({ path: `${name}/${id}` }),
    }));
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ get: mockGet });
    // Under every limit by default; individual tests override for specific windows.
    mockTransactionGet.mockResolvedValue({ data: () => undefined });
  });

  const callJobs = (data: unknown, rawRequestOverride?: Record<string, unknown>) =>
    (jobs as unknown as Function)({
      rawRequest: rawRequestOverride ?? { headers: { "x-forwarded-for": "9.9.9.9" } },
      data,
    });

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

    it("validates before spending quota: a rejected paste never touches the rate limit", async () => {
      await expect(callJobs({ text: "too short" })).rejects.toThrow();
      expect(mockTransactionGet).not.toHaveBeenCalled();
    });

    it("consumes the rate limit before writing the doc", async () => {
      mockAdd.mockResolvedValueOnce({ id: "pasted-doc-id" });

      await callJobs({ text: description });
      expect(mockTransactionGet).toHaveBeenCalled();
      expect(mockTransactionSet).toHaveBeenCalledTimes(3);
      expect(mockAdd).toHaveBeenCalled();
    });

    it("rejects a paste once the global daily cap on new scrapes/parses is hit", async () => {
      mockTransactionGet
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) }) // hourly
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) }) // daily
        .mockResolvedValueOnce({ data: () => ({ count: DAILY_GLOBAL_LIMIT }) }); // global

      await expect(callJobs({ text: description })).rejects.toThrow("today's limit");
      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe("rate limiting", () => {
    it("does not touch the rate limit on a cache hit", async () => {
      mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "existing-doc-id" }] });

      await callJobs({ url: "https://example.com/cached-job" });
      expect(mockTransactionGet).not.toHaveBeenCalled();
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("rejects a fresh URL once the caller is over the hourly limit", async () => {
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
      mockTransactionGet
        .mockResolvedValueOnce({ data: () => ({ count: HOURLY_LIMIT_PER_CLIENT }) }) // hourly
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) }) // daily
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) }); // global

      await expect(callJobs({ url: "https://example.com/too-many" })).rejects.toThrow("this hour");
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("consumes hourly, daily and global counters for a fresh URL, keyed by a hash rather than the raw IP", async () => {
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
      mockAdd.mockResolvedValueOnce({ id: "new-doc-id" });

      await callJobs({ url: "https://example.com/fresh-job" });
      expect(mockTransactionSet).toHaveBeenCalledTimes(3);
      const paths = mockTransactionSet.mock.calls.map(([ref]) => (ref as { path: string }).path);
      expect(paths.every((path) => path.startsWith("jobRateLimits/"))).toBe(true);
      expect(paths.some((path) => path.startsWith("jobRateLimits/global_"))).toBe(true);
      expect(paths.every((path) => !path.includes("9.9.9.9"))).toBe(true);
    });
  });
});
