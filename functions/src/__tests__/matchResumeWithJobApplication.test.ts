import { describe, it, expect, vi, beforeEach } from "vitest";
import { usagePeriod } from "../lib/aiAllowance";

// --- Shared mock state (const so vi.mock hoisting can access them) ---

const mockGet = vi.fn();
const mockRunTransaction = vi.fn();
const mockGenerate = vi.fn();

// --- Mock firebase-admin/firestore ---

let docCallIndex = 0;

function createDocRef(id: string) {
  return {
    id,
    get: mockGet,
    collection: (sub: string) => ({
      doc: (subId: string) => createDocRef(subId || `auto-${docCallIndex++}`),
    }),
  };
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `auto-doc-${docCallIndex++}`;
        return createDocRef(docId);
      },
    }),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  }),
  FieldValue: {
    serverTimestamp: () => "mock-ts",
    increment: (n: number) => ({ __increment: n }),
  },
}));

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = "HttpsError";
    }
  }
  return { HttpsError, onCall: (fn: unknown) => fn };
});

vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "" }),
}));

vi.mock("genkit", () => {
  // Zod recursive proxy for deeply nested schema chains
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

// --- Import the function under test ---
import { matchResumeWithJobApplication } from "../matchResumeWithJobApplication";

// Cast to callable (onCall mock returns the raw handler)
const handler = matchResumeWithJobApplication as unknown as (
  request: { auth?: { uid: string }; data: Record<string, unknown> },
) => Promise<unknown>;

// --- Helpers ---

const USER_ID = "user-1";
const OTHER_USER = "user-other";
const RESUME_ID = "resume-1";
const APP_ID = "app-1";

const CURRENT_PERIOD = usagePeriod(new Date());

// checksUsed = AI checks already spent this month on the free plan (limit 15)
const makeBillingSnap = (checksUsed: number) => ({
  exists: true,
  data: () => ({
    aiUsage: { period: CURRENT_PERIOD, count: checksUsed },
    bonusChecks: 0,
  }),
});

const makeResumeSnap = (userId: string, text?: string) => ({
  exists: true,
  data: () => ({ userId, text }),
});

const makeAppSnap = (userId: string, jobDescription?: string) => ({
  exists: true,
  data: () => ({ userId, jobDescription }),
});

const missingSnap = () => ({
  exists: false,
  data: () => undefined,
});

const RESUME_TEXT = `Maya Chen, Frontend Engineer
Built a Vue 3 design system used by 40 engineers.
Led the migration from JavaScript to TypeScript across 12 services.`;

const MOCK_AI_OUTPUT = {
  companyName: "Acme",
  position: "Frontend Engineer",
  parseCheck: { status: "clean", note: "" },
  matchScore: 72,
  verdict: "Strong Vue work, no GraphQL.",
  requirements: [
    {
      requirement: "Vue 3",
      status: "matched",
      importance: "must-have",
      evidence: "Built a Vue 3 design system used by 40 engineers.",
    },
    {
      requirement: "TypeScript",
      status: "partial",
      importance: "must-have",
      evidence: "Led the migration from JavaScript to TypeScript",
    },
    {
      requirement: "GraphQL",
      status: "missing",
      importance: "nice-to-have",
      evidence: "",
    },
  ],
  missingKeywords: ["GraphQL"],
  fixes: [
    {
      gap: "GraphQL",
      where: "Skills",
      action: "Name GraphQL only if you have used it.",
    },
  ],
  technologies: ["Vue", "TypeScript", "GraphQL"],
};

/**
 * The source makes these .get() calls in order:
 * 1. billingProfileRef.get()
 * 2. Promise.all([resume.get(), jobApplication.get()])
 *
 * Since all use the same mockGet, we set up 3 sequential return values.
 */
function setupGetMocks(opts: {
  checksUsed?: number;
  resumeUserId?: string;
  resumeText?: string;
  appUserId?: string;
  appJobDescription?: string;
  resumeMissing?: boolean;
  appMissing?: boolean;
  billingMissing?: boolean;
}) {
  const {
    checksUsed = 0,
    resumeUserId = USER_ID,
    resumeText = RESUME_TEXT,
    appUserId = USER_ID,
    appJobDescription = "Software Engineer job description",
    resumeMissing = false,
    appMissing = false,
    billingMissing = false,
  } = opts;

  mockGet
    .mockResolvedValueOnce(
      billingMissing ? missingSnap() : makeBillingSnap(checksUsed),
    )
    .mockResolvedValueOnce(
      resumeMissing ? missingSnap() : makeResumeSnap(resumeUserId, resumeText),
    )
    .mockResolvedValueOnce(
      appMissing ? missingSnap() : makeAppSnap(appUserId, appJobDescription),
    );
}

function setupTransaction(checksUsed: number) {
  const writes: { creates: unknown[]; updates: unknown[] } = {
    creates: [],
    updates: [],
  };

  mockRunTransaction.mockImplementation(async (fn: (t: unknown) => unknown) => {
    const transaction = {
      get: vi.fn().mockResolvedValue(makeBillingSnap(checksUsed)),
      create: vi.fn((...args: unknown[]) => writes.creates.push(args)),
      update: vi.fn((...args: unknown[]) => writes.updates.push(args)),
    };
    await fn(transaction);
    return writes;
  });

  return writes;
}

function setupHappyPath(checksUsed = 0) {
  setupGetMocks({ checksUsed });
  mockGenerate.mockResolvedValue({ output: MOCK_AI_OUTPUT });
  const writes = setupTransaction(checksUsed);
  return { writes };
}

function callHandler(
  data: Record<string, unknown> = { resumeId: RESUME_ID, applicationId: APP_ID },
  uid: string = USER_ID,
) {
  return handler({ auth: { uid }, data });
}

// --- Tests ---

describe("matchResumeWithJobApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    docCallIndex = 0;
  });

  // --- Validation ---

  describe("validation", () => {
    it("throws invalid-argument when resumeId is missing", async () => {
      await expect(
        callHandler({ applicationId: APP_ID }),
      ).rejects.toMatchObject({ code: "invalid-argument" });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("throws invalid-argument when applicationId is missing", async () => {
      await expect(
        callHandler({ resumeId: RESUME_ID }),
      ).rejects.toMatchObject({ code: "invalid-argument" });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // --- Ownership ---

  describe("ownership", () => {
    it("throws permission-denied when resume belongs to another user", async () => {
      setupGetMocks({ resumeUserId: OTHER_USER });

      await expect(callHandler()).rejects.toMatchObject({
        code: "permission-denied",
      });

      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("throws permission-denied when application belongs to another user", async () => {
      setupGetMocks({ appUserId: OTHER_USER });

      await expect(callHandler()).rejects.toMatchObject({
        code: "permission-denied",
      });

      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });

  // --- Data existence ---

  describe("data existence", () => {
    it("throws when resume does not exist", async () => {
      setupGetMocks({ resumeMissing: true });

      // Source checks ownership before existence, so a missing resume
      // (with undefined userId) triggers permission-denied from
      // validateResourceOwnership before the not-found check.
      await expect(callHandler()).rejects.toThrow();
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("throws when job application does not exist", async () => {
      setupGetMocks({ appMissing: true });

      await expect(callHandler()).rejects.toThrow();
      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });

  // --- Credit safety ---

  describe("allowance", () => {
    it("rejects before calling the model when the monthly allowance is used up", async () => {
      setupGetMocks({ checksUsed: 15 });

      await expect(callHandler()).rejects.toMatchObject({
        code: "resource-exhausted",
        details: { code: "ai-limit-reached", plan: "free", limit: 15 },
      });
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("does not count a check when AI generation fails", async () => {
      setupGetMocks({});
      mockGenerate.mockRejectedValue(new Error("AI exploded"));

      await expect(callHandler()).rejects.toThrow();

      // Transaction should never run since AI failed before it
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("aborts the transaction when the allowance ran out between pre-check and save", async () => {
      setupGetMocks({ checksUsed: 14 });
      mockGenerate.mockResolvedValue({ output: MOCK_AI_OUTPUT });

      // Transaction re-reads billing and finds insufficient balance
      mockRunTransaction.mockImplementation(
        async (fn: (t: unknown) => unknown) => {
          const transaction = {
            get: vi.fn().mockResolvedValue(makeBillingSnap(15)),
            create: vi.fn(),
            update: vi.fn(),
          };
          await fn(transaction);
          return transaction;
        },
      );

      await expect(callHandler()).rejects.toMatchObject({
        code: "resource-exhausted",
        details: { code: "ai-limit-reached" },
      });
    });

    it("counts one AI check and creates the match on success", async () => {
      const { writes } = setupHappyPath(3);

      const result = await callHandler();

      expect(result).toEqual({ success: true });

      expect(writes.updates.length).toBe(1);
      const updateArgs = writes.updates[0] as unknown[];
      const updateData = updateArgs[1] as Record<string, unknown>;
      expect(updateData.aiUsage).toEqual({ period: CURRENT_PERIOD, count: 4 });
      expect(updateData.bonusChecks).toBe(0);

      // Verify match result creation
      expect(writes.creates.length).toBe(1);
      const createArgs = writes.creates[0] as unknown[];
      const createData = createArgs[1] as Record<string, unknown>;
      expect(createData.userId).toBe(USER_ID);
      expect(createData.resumeId).toBe(RESUME_ID);
      expect(createData.jobApplicationId).toBe(APP_ID);
      expect(createData.matchResult).toMatchObject({
        match_summary: { overall_match_percent: 72 },
      });
    });
  });

  // --- Evidence-verified engine (same as the free tool) ---

  describe("evidence", () => {
    function storedMatch(writes: { creates: unknown[] }) {
      const createArgs = writes.creates[0] as unknown[];
      return createArgs[1] as {
        matchResult: {
          match_summary: { overall_match_percent: number; summary: string };
          skills_comparison: Record<
            string,
            { skill: string; status: string; evidence?: string }[] | undefined
          >;
          recommendations: { improvement_areas?: string[] };
        };
        analysis: { requirements: { requirement: string; status: string; evidence: string }[] };
      };
    }

    it("builds the prompt in code with the never-invent rule, not from Firestore", async () => {
      setupHappyPath();

      await callHandler();

      // billing + resume + job application; no promptTemplates read
      expect(mockGet).toHaveBeenCalledTimes(3);
      const { prompt } = mockGenerate.mock.calls[0][0] as { prompt: string };
      expect(prompt).toContain("never invent anything");
      expect(prompt).toContain(RESUME_TEXT);
      expect(prompt).toContain("Software Engineer job description");
    });

    it("keeps requirements whose evidence is verbatim in the resume", async () => {
      const { writes } = setupHappyPath();

      await callHandler();

      const { matchResult } = storedMatch(writes);
      expect(matchResult.match_summary).toEqual({
        overall_match_percent: 72,
        summary: "Strong Vue work, no GraphQL.",
      });
      expect(matchResult.skills_comparison.matched_skills).toEqual([
        {
          skill: "Vue 3",
          status: "matched",
          evidence: "Built a Vue 3 design system used by 40 engineers.",
        },
      ]);
      expect(matchResult.skills_comparison.partially_matched_skills).toEqual([
        {
          skill: "TypeScript",
          status: "partial",
          evidence: "Led the migration from JavaScript to TypeScript",
        },
      ]);
      expect(matchResult.skills_comparison.missing_skills).toEqual([
        { skill: "GraphQL", status: "missing" },
      ]);
      expect(matchResult.recommendations.improvement_areas).toEqual([
        "GraphQL: Name GraphQL only if you have used it.",
      ]);
    });

    it("downgrades Met and Partly requirements whose evidence is not in the resume", async () => {
      setupGetMocks({});
      mockGenerate.mockResolvedValue({
        output: {
          ...MOCK_AI_OUTPUT,
          requirements: [
            {
              requirement: "German (fluent)",
              status: "matched",
              importance: "must-have",
              evidence: "Native German speaker",
            },
            {
              requirement: "Kubernetes",
              status: "partial",
              importance: "nice-to-have",
              evidence: "Deployed services on Kubernetes",
            },
            MOCK_AI_OUTPUT.requirements[0],
          ],
        },
      });
      const writes = setupTransaction(0);

      await callHandler();

      const { matchResult, analysis } = storedMatch(writes);
      expect(matchResult.skills_comparison.matched_skills).toEqual([
        {
          skill: "Vue 3",
          status: "matched",
          evidence: "Built a Vue 3 design system used by 40 engineers.",
        },
      ]);
      expect(matchResult.skills_comparison.partially_matched_skills).toEqual([]);
      expect(matchResult.skills_comparison.missing_skills).toEqual([
        { skill: "German (fluent)", status: "missing" },
        { skill: "Kubernetes", status: "missing" },
      ]);
      expect(JSON.stringify(matchResult)).not.toContain("Native German speaker");
      expect(JSON.stringify(analysis)).not.toContain("Deployed services on Kubernetes");
      expect(analysis.requirements.map((requirement) => requirement.status)).toEqual([
        "missing",
        "missing",
        "matched",
      ]);
    });

    it("clamps the score to 0-100", async () => {
      setupGetMocks({});
      mockGenerate.mockResolvedValue({ output: { ...MOCK_AI_OUTPUT, matchScore: 104.4 } });
      const writes = setupTransaction(0);

      await callHandler();

      expect(storedMatch(writes).matchResult.match_summary.overall_match_percent).toBe(100);
    });

    it("does not count a check when the model returns nothing", async () => {
      setupGetMocks({});
      mockGenerate.mockResolvedValue({ output: null });

      await expect(callHandler()).rejects.toMatchObject({ code: "internal" });
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });
});
