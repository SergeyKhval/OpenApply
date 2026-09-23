import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerate = vi.fn();
const mockTransactionGet = vi.fn();
const mockTransactionSet = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}` }),
    }),
    runTransaction: async (fn: (t: unknown) => Promise<void>) =>
      fn({ get: mockTransactionGet, set: mockTransactionSet }),
  }),
  FieldValue: {
    serverTimestamp: () => "mock-ts",
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

vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "" }),
}));

vi.mock("genkit", () => {
  const createZodProxy = (): any =>
    new Proxy(() => createZodProxy(), {
      get: () => createZodProxy(),
      apply: () => createZodProxy(),
    });

  return {
    genkit: () => ({
      generate: (...args: unknown[]) => mockGenerate(...args),
    }),
    z: createZodProxy(),
  };
});

vi.mock("@genkit-ai/googleai", () => {
  const googleAI = () => ({});
  googleAI.model = () => ({});
  return { googleAI };
});

import { matchResumeTool } from "../matchResumeTool";

const validData = {
  resumeText: "Senior engineer with TypeScript and Vue experience. ".repeat(10),
  jobDescription: "We are hiring a frontend engineer who knows Vue. ".repeat(10),
};

const aiOutput = {
  companyName: "Acme",
  position: "Frontend Engineer",
  parseCheck: { status: "clean", note: "" },
  matchScore: 104.4,
  verdict: "Strong fit.",
  requirements: [
    {
      requirement: "Vue",
      status: "matched",
      importance: "must-have",
      evidence: "Senior engineer with TypeScript and Vue experience.",
    },
  ],
  missingKeywords: ["GraphQL"],
  fixes: [1, 2, 3, 4].map((n) => ({
    gap: `gap ${n}`,
    where: "Experience",
    action: "Name it if true",
  })),
  technologies: ["Vue", "TypeScript"],
};

const call = (request: Record<string, unknown>) =>
  (matchResumeTool as unknown as Function)({
    rawRequest: { headers: { "x-forwarded-for": "9.9.9.9" } },
    auth: { uid: "anon-1" },
    data: validData,
    ...request,
  });

const counterSnap = (count?: number) => ({
  data: () => (count === undefined ? undefined : { count }),
});

describe("matchResumeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactionGet.mockResolvedValue(counterSnap());
    mockGenerate.mockResolvedValue({ output: aiOutput });
  });

  it("requires a Firebase session", async () => {
    await expect(call({ auth: undefined })).rejects.toThrow("Session expired");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("validates input before spending quota", async () => {
    await expect(call({ data: { resumeText: "x", jobDescription: "y" } })).rejects.toThrow(
      "too short",
    );
    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it("rejects when the client is over the hourly limit", async () => {
    mockTransactionGet
      .mockResolvedValueOnce(counterSnap(6))
      .mockResolvedValueOnce(counterSnap(6))
      .mockResolvedValueOnce(counterSnap(6));
    await expect(call({})).rejects.toThrow("this hour");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("increments hourly, daily and global counters", async () => {
    await call({});
    expect(mockTransactionSet).toHaveBeenCalledTimes(3);
    const paths = mockTransactionSet.mock.calls.map(([ref]) => ref.path);
    expect(paths.some((path: string) => path.startsWith("toolUsage/global_"))).toBe(true);
    expect(paths.every((path: string) => !path.includes("9.9.9.9"))).toBe(true);
  });

  it("returns a clamped analysis", async () => {
    const result = await call({});
    expect(result.analysis.matchScore).toBe(100);
    expect(result.analysis.fixes).toHaveLength(3);
  });

  it("only writes rate limit counters, never the inputs", async () => {
    await call({});
    for (const [, payload] of mockTransactionSet.mock.calls) {
      expect(Object.keys(payload).sort()).toEqual(["count", "expiresAt"]);
    }
  });

  it("maps generation failures to an internal error", async () => {
    mockGenerate.mockRejectedValue(new Error("boom"));
    await expect(call({})).rejects.toThrow("wrong turn");
  });

  it("fails when the model returns no output", async () => {
    mockGenerate.mockResolvedValue({ output: null });
    await expect(call({})).rejects.toThrow("came back empty");
  });
});
