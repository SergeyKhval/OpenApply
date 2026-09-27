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

const mockLoggerInfo = vi.fn();

vi.mock("firebase-functions", () => ({
  logger: { info: (...args: unknown[]) => mockLoggerInfo(...args) },
}));

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

import { rewriteLinkedinProfile } from "../rewriteLinkedinProfile";

const validData = {
  headline: "Frontend Engineer at Acme Corp",
  about:
    "I build accessible web apps with React and TypeScript.\n\n" +
    "Previously led the checkout redesign at Acme, cutting load time by 30%.",
  targetRole: "",
};

const aiOutput = {
  why: "Led with your React experience.",
  headline: "Frontend Engineer specializing in React and TypeScript",
  aboutLines: [
    { id: "about-1", text: "I build accessible React and TypeScript web apps." },
    { id: "about-2", text: "Cut checkout load time 30% by leading the redesign at Acme." },
  ],
};

const call = (request: Record<string, unknown>) =>
  (rewriteLinkedinProfile as unknown as Function)({
    rawRequest: { headers: { "x-forwarded-for": "9.9.9.9" } },
    auth: { uid: "anon-1" },
    data: validData,
    ...request,
  });

const counterSnap = (count?: number) => ({
  data: () => (count === undefined ? undefined : { count }),
});

describe("rewriteLinkedinProfile", () => {
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
    await expect(call({ data: { headline: "x", about: "y" } })).rejects.toThrow("too short");
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

  it("increments hourly, daily and global counters in their own collection", async () => {
    await call({});
    expect(mockTransactionSet).toHaveBeenCalledTimes(3);
    const paths = mockTransactionSet.mock.calls.map(([ref]) => ref.path);
    expect(paths.some((path: string) => path.startsWith("linkedinToolUsage/global_"))).toBe(true);
    expect(paths.every((path: string) => !path.includes("9.9.9.9"))).toBe(true);
  });

  it("returns the verified rewrite", async () => {
    const result = await call({});
    expect(result.result.headline.changed).toBe(true);
    expect(result.result.about).toHaveLength(2);
  });

  it("only writes rate limit counters, never the inputs", async () => {
    await call({});
    for (const [, payload] of mockTransactionSet.mock.calls) {
      expect(Object.keys(payload).sort()).toEqual(["count", "expiresAt"]);
    }
  });

  it("logs how the client key was chosen without the IP", async () => {
    await call({});
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "rewriteLinkedinProfile client key",
      expect.objectContaining({ forwardedCount: 1, keyedBy: "ip" }),
    );
    expect(JSON.stringify(mockLoggerInfo.mock.calls)).not.toContain("9.9.9.9");
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
