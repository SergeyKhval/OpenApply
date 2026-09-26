import { beforeEach, describe, expect, it, vi } from "vitest";
import { usagePeriod } from "../lib/aiAllowance";
import { hashResumeText } from "../lib/tailorSegment";

// --- In-memory Firestore: documents by path, plus the one match query ---

const store = new Map<string, Record<string, unknown>>();
const matchQueries: { filters: [string, string, unknown][]; orderBy?: [string, string]; limit?: number }[] = [];
const transactionWrites: { op: "create" | "update" | "set"; path: string; data: Record<string, unknown> }[] = [];
let autoId = 0;

function snapshot(path: string) {
  const data = store.get(path);
  return { id: path.split("/").at(-1), exists: data !== undefined, data: () => data };
}

function docRef(path: string): Record<string, unknown> {
  return {
    id: path.split("/").at(-1),
    path,
    get: async () => snapshot(path),
    collection: (name: string) => collectionRef(`${path}/${name}`),
  };
}

function collectionRef(path: string) {
  const query = { filters: [] as [string, string, unknown][], orderBy: undefined as [string, string] | undefined, limit: undefined as number | undefined };
  const builder = {
    doc: (id?: string) => docRef(`${path}/${id ?? `auto-${++autoId}`}`),
    where: (field: string, operator: string, value: unknown) => {
      query.filters.push([field, operator, value]);
      return builder;
    },
    orderBy: (field: string, direction: string) => {
      query.orderBy = [field, direction];
      return builder;
    },
    limit: (count: number) => {
      query.limit = count;
      return builder;
    },
    get: async () => {
      matchQueries.push(query);
      const docs = [...store.entries()]
        .filter(([docPath]) => docPath.startsWith(`${path}/`) && docPath.split("/").length === path.split("/").length + 1)
        .filter(([, data]) => query.filters.every(([field, , value]) => data[field] === value))
        .sort(([, a], [, b]) => Number(b.createdAt) - Number(a.createdAt))
        .slice(0, query.limit ?? Infinity)
        .map(([docPath]) => snapshot(docPath));
      return { docs };
    },
  };
  return builder;
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => collectionRef(name),
    runTransaction: async (fn: (transaction: unknown) => Promise<unknown>) =>
      fn({
        get: async (ref: { path: string }) => snapshot(ref.path),
        create: (ref: { path: string }, data: Record<string, unknown>) => transactionWrites.push({ op: "create", path: ref.path, data }),
        update: (ref: { path: string }, data: Record<string, unknown>) => transactionWrites.push({ op: "update", path: ref.path, data }),
        set: (ref: { path: string }, data: Record<string, unknown>) => transactionWrites.push({ op: "set", path: ref.path, data }),
      }),
  }),
  FieldValue: { serverTimestamp: () => "mock-ts" },
}));

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return { HttpsError, onCall: (fn: unknown) => fn };
});

vi.mock("firebase-functions/params", () => ({ defineString: () => ({ value: () => "" }) }));

const mockTailorResume = vi.fn();
vi.mock("../lib/tailorEngine", () => ({
  TAILOR_MODEL: "gemini-3.5-flash",
  TAILOR_PROMPT_VERSION: "tailor-v2",
  tailorResume: (...args: unknown[]) => mockTailorResume(...args),
}));

import { createTailoredResume } from "../createTailoredResume";

const handler = createTailoredResume as unknown as (request: {
  auth?: { uid: string };
  data: Record<string, unknown>;
}) => Promise<{ tailoredResumeId: string | null; stats: Record<string, unknown> }>;

// --- Fixtures ---

const USER_ID = "user-1";
const RESUME_TEXT = "Maya Chen\nExperience\nEngineer, Acme\n2020 – 2024\n• Built a Vue 3 design system.";
const ANALYSIS = { matchScore: 70, parseCheck: { status: "clean", note: "" }, requirements: [], missingKeywords: [], fixes: [], technologies: [] };
const RESULT = {
  lines: [{ id: "L1", text: "Maya Chen", bullet: false, role: "locked", owner: null, section: null }],
  sectionOrder: [],
  ops: [{ kind: "moveUp", lineIds: ["L5"], text: "", term: "", requirement: 0, reason: "", index: 0, status: "applied" }],
  doc: { sections: [] },
  stats: { proposed: 1, applied: 1, reverted: 0, byReason: {} },
  usage: { inputTokens: 1600, outputTokens: 400, thoughtsTokens: 3600 },
};

function seed({
  checksUsed = 0,
  resumeOwner = USER_ID,
  applicationOwner = USER_ID,
  resumeText = RESUME_TEXT,
  match = { analysis: ANALYSIS, resumeTextHash: hashResumeText(RESUME_TEXT) } as Record<string, unknown> | null,
} = {}) {
  store.set("userResumes/resume-1", { userId: resumeOwner, fileName: "maya.pdf", text: resumeText });
  store.set("jobApplications/app-1", { userId: applicationOwner, companyName: "Globex", position: "Frontend Engineer" });
  store.set("users/user-1/billingProfile/profile", { aiUsage: { period: usagePeriod(new Date()), count: checksUsed }, bonusChecks: 0 });
  if (match) {
    // An older match of the same pair, which must be ignored
    store.set("resumeJobMatches/old", { userId: USER_ID, resumeId: "resume-1", jobApplicationId: "app-1", createdAt: 1, analysis: ANALYSIS, resumeTextHash: "stale" });
    store.set("resumeJobMatches/newest", { userId: USER_ID, resumeId: "resume-1", jobApplicationId: "app-1", createdAt: 2, ...match });
  }
}

const call = (data: Record<string, unknown> = { resumeId: "resume-1", applicationId: "app-1" }, uid: string | null = USER_ID) =>
  handler({ ...(uid ? { auth: { uid } } : {}), data });

const created = () => transactionWrites.filter((write) => write.op === "create");

describe("createTailoredResume", () => {
  beforeEach(() => {
    store.clear();
    matchQueries.length = 0;
    transactionWrites.length = 0;
    mockTailorResume.mockReset().mockResolvedValue(RESULT);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  describe("input and access", () => {
    it("requires sign-in", async () => {
      await expect(call(undefined, null)).rejects.toMatchObject({ code: "unauthenticated" });
    });

    it.each([[{}], [{ resumeId: "resume-1" }], [{ applicationId: "app-1" }], [{ resumeId: 3, applicationId: "app-1" }]])(
      "rejects bad input %j",
      async (data) => {
        await expect(call(data)).rejects.toMatchObject({ code: "invalid-argument" });
      },
    );

    it("refuses someone else's resume or job", async () => {
      seed({ resumeOwner: "user-2" });
      await expect(call()).rejects.toMatchObject({ code: "permission-denied" });
      store.clear();
      seed({ applicationOwner: "user-2" });
      await expect(call()).rejects.toMatchObject({ code: "permission-denied" });
      expect(mockTailorResume).not.toHaveBeenCalled();
    });

    it("says not-found for a missing resume", async () => {
      seed();
      store.delete("userResumes/resume-1");
      await expect(call()).rejects.toMatchObject({ code: "not-found" });
    });
  });

  describe("match freshness", () => {
    it("asks for a match check first when there is none", async () => {
      seed({ match: null });
      await expect(call()).rejects.toMatchObject({ code: "failed-precondition", details: { code: "no_match" } });
      expect(mockTailorResume).not.toHaveBeenCalled();
    });

    it("refuses a legacy match without the stored analysis", async () => {
      seed({ match: { resumeTextHash: hashResumeText(RESUME_TEXT) } });
      await expect(call()).rejects.toMatchObject({ details: { code: "no_match" } });
    });

    it("refuses a match of older resume text", async () => {
      seed({ match: { analysis: ANALYSIS, resumeTextHash: hashResumeText("an older resume") } });
      await expect(call()).rejects.toMatchObject({ code: "failed-precondition", details: { code: "stale_match" } });
      expect(mockTailorResume).not.toHaveBeenCalled();
    });

    it("reads only the newest match of this user, resume and job", async () => {
      seed();
      await call();
      expect(matchQueries[0]).toEqual({
        filters: [
          ["userId", "==", USER_ID],
          ["resumeId", "==", "resume-1"],
          ["jobApplicationId", "==", "app-1"],
        ],
        orderBy: ["createdAt", "desc"],
        limit: 1,
      });
      expect(mockTailorResume).toHaveBeenCalledWith({ resumeText: RESUME_TEXT, analysis: ANALYSIS });
    });
  });

  describe("allowance", () => {
    it("rejects before calling the model when checks are used up", async () => {
      seed({ checksUsed: 15 });
      await expect(call()).rejects.toMatchObject({ code: "resource-exhausted", details: { code: "ai-limit-reached" } });
      expect(mockTailorResume).not.toHaveBeenCalled();
    });

    it("counts nothing and saves nothing when the model fails", async () => {
      seed();
      mockTailorResume.mockRejectedValue(new Error("model down"));
      await expect(call()).rejects.toMatchObject({ code: "internal" });
      expect(transactionWrites).toEqual([]);
    });

    it("passes the engine's own refusals through with their code", async () => {
      seed();
      const refusal = Object.assign(new (await import("firebase-functions/v2/https")).HttpsError("failed-precondition", "jumbled"), {
        details: { code: "scrambled" },
      });
      mockTailorResume.mockRejectedValue(refusal);
      await expect(call()).rejects.toMatchObject({ code: "failed-precondition", details: { code: "scrambled" } });
      expect(transactionWrites).toEqual([]);
    });

    it("is free when no edit survives the checks", async () => {
      seed();
      mockTailorResume.mockResolvedValue({ ...RESULT, ops: [], stats: { proposed: 3, applied: 0, reverted: 3, byReason: { new_fact: 3 } } });
      await expect(call()).resolves.toEqual({ tailoredResumeId: null, stats: { proposed: 3, applied: 0, reverted: 3, byReason: { new_fact: 3 } } });
      expect(transactionWrites).toEqual([]);
    });
  });

  describe("success", () => {
    it("charges one check and saves the tailored version in one transaction", async () => {
      seed({ checksUsed: 4 });
      const result = await call();

      expect(result.tailoredResumeId).toMatch(/^auto-/);
      const billing = transactionWrites.find((write) => write.path === "users/user-1/billingProfile/profile");
      expect(billing?.data).toMatchObject({ aiUsage: { period: usagePeriod(new Date()), count: 5 } });

      const [saved] = created();
      expect(saved.path).toBe(`tailoredResumes/${result.tailoredResumeId}`);
      expect(saved.data).toMatchObject({
        userId: USER_ID,
        resumeId: "resume-1",
        jobApplicationId: "app-1",
        matchId: "newest",
        resume: { id: "resume-1", fileName: "maya.pdf" },
        jobApplication: { id: "app-1", companyName: "Globex", position: "Frontend Engineer" },
        sourceTextHash: hashResumeText(RESUME_TEXT),
        lines: RESULT.lines,
        ops: RESULT.ops,
        excludedOpIds: [],
        stats: RESULT.stats,
        usage: RESULT.usage,
        model: "gemini-3.5-flash",
        promptVersion: "tailor-v2",
      });
    });

    it("logs counts and tokens but never resume text", async () => {
      seed();
      await call();
      const logged = JSON.stringify(vi.mocked(console.log).mock.calls);
      expect(logged).toContain("thoughtsTokens");
      expect(logged).not.toContain("Maya Chen");
      expect(logged).not.toContain("Vue 3");
    });
  });
});
