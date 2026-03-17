import { describe, it, expect, vi, beforeEach } from "vitest";

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

const makeBillingSnap = (balance: number) => ({
  exists: true,
  data: () => ({ currentBalance: balance }),
});

const makePromptSnap = (template?: string) => ({
  exists: !!template,
  data: () => (template ? { template } : undefined),
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

const MOCK_AI_OUTPUT = {
  match_summary: { overall_match_percent: 85, summary: "Good match" },
  skills_comparison: { matched_skills: [] },
  recommendations: {},
};

/**
 * The source makes these .get() calls in order:
 * 1. billingProfileRef.get()
 * 2. Promise.all([promptTemplate.get(), resume.get(), jobApplication.get()])
 *
 * Since all use the same mockGet, we set up 4 sequential return values.
 */
function setupGetMocks(opts: {
  billingBalance?: number;
  promptTemplate?: string;
  resumeUserId?: string;
  resumeText?: string;
  appUserId?: string;
  appJobDescription?: string;
  resumeMissing?: boolean;
  appMissing?: boolean;
  billingMissing?: boolean;
}) {
  const {
    billingBalance = 100,
    promptTemplate = "Resume: {{ resumeText }} JD: {{ jobDescriptionText }}",
    resumeUserId = USER_ID,
    resumeText = "My resume text",
    appUserId = USER_ID,
    appJobDescription = "Software Engineer job description",
    resumeMissing = false,
    appMissing = false,
    billingMissing = false,
  } = opts;

  mockGet
    .mockResolvedValueOnce(
      billingMissing ? missingSnap() : makeBillingSnap(billingBalance),
    )
    .mockResolvedValueOnce(
      promptTemplate ? makePromptSnap(promptTemplate) : makePromptSnap(undefined),
    )
    .mockResolvedValueOnce(
      resumeMissing ? missingSnap() : makeResumeSnap(resumeUserId, resumeText),
    )
    .mockResolvedValueOnce(
      appMissing ? missingSnap() : makeAppSnap(appUserId, appJobDescription),
    );
}

function setupTransaction(billingBalance: number) {
  const writes: { creates: unknown[]; updates: unknown[] } = {
    creates: [],
    updates: [],
  };

  mockRunTransaction.mockImplementation(async (fn: (t: unknown) => unknown) => {
    const transaction = {
      get: vi.fn().mockResolvedValue(makeBillingSnap(billingBalance)),
      create: vi.fn((...args: unknown[]) => writes.creates.push(args)),
      update: vi.fn((...args: unknown[]) => writes.updates.push(args)),
    };
    await fn(transaction);
    return writes;
  });

  return writes;
}

function setupHappyPath(billingBalance = 100) {
  setupGetMocks({ billingBalance });
  mockGenerate.mockResolvedValue({ output: MOCK_AI_OUTPUT });
  const writes = setupTransaction(billingBalance);
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
    it("throws when prompt template is missing", async () => {
      // Manually set up mocks to return missing prompt template data
      mockGet
        .mockResolvedValueOnce(makeBillingSnap(100))
        .mockResolvedValueOnce({ exists: false, data: () => undefined })
        .mockResolvedValueOnce(makeResumeSnap(USER_ID, "text"))
        .mockResolvedValueOnce(makeAppSnap(USER_ID, "desc"));

      await expect(callHandler()).rejects.toMatchObject({
        code: "failed-precondition",
      });

      expect(mockGenerate).not.toHaveBeenCalled();
    });

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

  describe("credit safety", () => {
    it("does not deduct credits when AI generation fails", async () => {
      setupGetMocks({});
      mockGenerate.mockRejectedValue(new Error("AI exploded"));

      await expect(callHandler()).rejects.toThrow();

      // Transaction should never run since AI failed before it
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("aborts transaction when balance dropped below required between pre-check and transaction", async () => {
      setupGetMocks({ billingBalance: 100 });
      mockGenerate.mockResolvedValue({ output: MOCK_AI_OUTPUT });

      // Transaction re-reads billing and finds insufficient balance
      mockRunTransaction.mockImplementation(
        async (fn: (t: unknown) => unknown) => {
          const transaction = {
            get: vi.fn().mockResolvedValue(makeBillingSnap(5)), // only 5, need 10
            create: vi.fn(),
            update: vi.fn(),
          };
          await fn(transaction);
          return transaction;
        },
      );

      await expect(callHandler()).rejects.toMatchObject({
        code: "failed-precondition",
        details: { code: "insufficient-credits" },
      });
    });

    it("deducts credits via FieldValue.increment(-10) and creates match on success", async () => {
      const { writes } = setupHappyPath(100);

      const result = await callHandler();

      expect(result).toEqual({ success: true });

      // Verify credit deduction
      expect(writes.updates.length).toBe(1);
      const updateArgs = writes.updates[0] as unknown[];
      const updateData = updateArgs[1] as Record<string, unknown>;
      expect(updateData.currentBalance).toEqual({ __increment: -10 });

      // Verify match result creation
      expect(writes.creates.length).toBe(1);
      const createArgs = writes.creates[0] as unknown[];
      const createData = createArgs[1] as Record<string, unknown>;
      expect(createData.userId).toBe(USER_ID);
      expect(createData.resumeId).toBe(RESUME_ID);
      expect(createData.jobApplicationId).toBe(APP_ID);
      expect(createData.matchResult).toEqual(MOCK_AI_OUTPUT);
    });
  });
});
