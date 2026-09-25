import { describe, it, expect, vi, beforeEach } from "vitest";
import { usagePeriod } from "../lib/aiAllowance";

// --- Shared mock state ---

const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockTransactionGet = vi.fn();
const mockTransactionCreate = vi.fn();
const mockTransactionUpdate = vi.fn();
const mockRunTransaction = vi.fn();
const mockGenerate = vi.fn();

// Track doc() calls to return different refs
let docCallIndex = 0;
const docRefs: Record<string, ReturnType<typeof createDocRef>> = {};

function createDocRef(id: string) {
  return {
    id,
    get: mockGet,
    create: mockCreate,
    update: mockUpdate,
    collection: () => ({
      doc: (subId: string) => createDocRef(subId || `auto-${docCallIndex++}`),
    }),
  };
}

// --- Mock firebase-admin/firestore ---
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `auto-doc-${docCallIndex++}`;
        const ref = createDocRef(docId);
        docRefs[`${name}/${docId}`] = ref;
        return ref;
      },
    }),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  }),
  FieldValue: {
    serverTimestamp: () => "mock-server-timestamp",
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

vi.mock("genkit", () => ({
  genkit: () => ({ generate: (...args: unknown[]) => mockGenerate(...args) }),
}));

vi.mock("@genkit-ai/googleai", () => {
  const googleAI = () => ({});
  googleAI.model = () => ({});
  return { googleAI };
});

vi.mock("firebase-admin", () => ({
  firestore: {},
}));

import {
  generateCoverLetter,
  regenerateCoverLetter,
} from "../generateCoverLetter";

// Helper to create a mock Firestore snapshot
function snap(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists,
    data: () => data,
    id: data?.id || "mock-id",
  };
}

// The authenticated request wrapper
function authRequest(
  uid: string,
  data: Record<string, unknown>,
) {
  return { auth: { uid }, data };
}

// Standard valid data fixtures
const USER_ID = "user-123";
const JOB_APP_ID = "job-app-1";
const RESUME_ID = "resume-1";
const COVER_LETTER_ID = "cl-1";

const CURRENT_PERIOD = usagePeriod(new Date());
const validBillingProfile = {
  aiUsage: { period: CURRENT_PERIOD, count: 3 },
  bonusChecks: 0,
};
const exhaustedBillingProfile = {
  aiUsage: { period: CURRENT_PERIOD, count: 15 },
  bonusChecks: 0,
};
const validJobApplication = {
  userId: USER_ID,
  companyName: "Acme Corp",
  position: "Engineer",
  jobDescription: "Build things",
};
const validResume = { userId: USER_ID, text: "My resume text" };
const validPromptTemplate = { template: "Write a cover letter for {{ companyName }} {{ position }} {{ resumeText }} {{ jobDescription }}" };

// Setup for a successful generateCoverLetter flow
function setupSuccessfulGenerate() {
  // 1. validateBillingBalance -> billing profile get
  mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
  // 2. fetchAndValidateJobApplication -> job application get
  mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
  // 3. fetchAndValidateResume -> resume get
  mockGet.mockResolvedValueOnce(snap(true, validResume));
  // 4. buildCoverLetterPrompt -> prompt template get
  mockGet.mockResolvedValueOnce(snap(true, validPromptTemplate));
  // 5. AI generation
  mockGenerate.mockResolvedValueOnce({ text: "Generated cover letter body" });
  // 6. Transaction
  mockRunTransaction.mockImplementationOnce(async (callback: Function) => {
    const transactionBillingSnap = snap(true, validBillingProfile);
    mockTransactionGet.mockResolvedValueOnce(transactionBillingSnap);
    await callback({
      get: mockTransactionGet,
      create: mockTransactionCreate,
      update: mockTransactionUpdate,
    });
  });
}

function setupSuccessfulRegenerate() {
  // 1. validateBillingBalance -> billing profile get
  mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
  // 2. cover letter ownership check
  mockGet.mockResolvedValueOnce(snap(true, { userId: USER_ID, body: "old body" }));
  // 3. fetchAndValidateJobApplication -> job application get
  mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
  // 4. fetchAndValidateResume -> resume get
  mockGet.mockResolvedValueOnce(snap(true, validResume));
  // 5. buildCoverLetterPrompt -> prompt template get
  mockGet.mockResolvedValueOnce(snap(true, validPromptTemplate));
  // 6. AI generation
  mockGenerate.mockResolvedValueOnce({ text: "Regenerated cover letter body" });
  // 7. Transaction
  mockRunTransaction.mockImplementationOnce(async (callback: Function) => {
    const transactionBillingSnap = snap(true, validBillingProfile);
    mockTransactionGet.mockResolvedValueOnce(transactionBillingSnap);
    await callback({
      get: mockTransactionGet,
      create: mockTransactionCreate,
      update: mockTransactionUpdate,
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReset();
  docCallIndex = 0;
});

// Cast the onCall-wrapped functions to callable form
const callGenerate = generateCoverLetter as unknown as (
  req: ReturnType<typeof authRequest>,
) => Promise<{ coverLetterId: string; body: string }>;

const callRegenerate = regenerateCoverLetter as unknown as (
  req: ReturnType<typeof authRequest>,
) => Promise<{ body: string }>;

// ============================================================
// generateCoverLetter tests
// ============================================================

describe("generateCoverLetter orchestration", () => {
  describe("Allowance", () => {
    it("rejects before calling the model when the monthly allowance is used up", async () => {
      mockGet.mockResolvedValueOnce(snap(true, exhaustedBillingProfile));

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      await expect(callGenerate(request)).rejects.toMatchObject({
        code: "resource-exhausted",
        details: { code: "ai-limit-reached" },
      });
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("does not count a check when AI generation fails", async () => {
      // Setup: billing OK, job app OK, resume OK, prompt template OK, but AI fails
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
      mockGet.mockResolvedValueOnce(snap(true, validResume));
      mockGet.mockResolvedValueOnce(snap(true, validPromptTemplate));
      mockGenerate.mockRejectedValueOnce(new Error("AI service unavailable"));

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      await expect(callGenerate(request)).rejects.toThrow("AI service unavailable");
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("throws ai-limit-reached when the allowance runs out during the transaction", async () => {
      // Setup: pre-check passes, but transaction re-check fails
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
      mockGet.mockResolvedValueOnce(snap(true, validResume));
      mockGet.mockResolvedValueOnce(snap(true, validPromptTemplate));
      mockGenerate.mockResolvedValueOnce({ text: "Generated body" });

      // Transaction: another request used the last check
      mockRunTransaction.mockImplementationOnce(async (callback: Function) => {
        mockTransactionGet.mockResolvedValueOnce(snap(true, exhaustedBillingProfile));
        await callback({
          get: mockTransactionGet,
          create: mockTransactionCreate,
          update: mockTransactionUpdate,
        });
      });

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      await expect(callGenerate(request)).rejects.toMatchObject({ details: { code: "ai-limit-reached" } });
      // Transaction ran but should NOT have called create/update on the cover letter
      expect(mockTransactionCreate).not.toHaveBeenCalled();
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it("counts exactly one check and creates cover letter on success", async () => {
      setupSuccessfulGenerate();

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      const result = await callGenerate(request);

      expect(result.body).toBe("Generated cover letter body");
      expect(result.coverLetterId).toBeDefined();

      // Transaction ran exactly once
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);

      // Cover letter was created in transaction
      expect(mockTransactionCreate).toHaveBeenCalledTimes(1);
      const createArgs = mockTransactionCreate.mock.calls[0];
      expect(createArgs[1]).toMatchObject({
        userId: USER_ID,
        body: "Generated cover letter body",
        resumeId: RESUME_ID,
      });

      // Job application was updated in transaction
      expect(mockTransactionUpdate).toHaveBeenCalledTimes(2); // cover letter update + billing update
      const billingUpdateCall = mockTransactionUpdate.mock.calls.find(
        (call: unknown[]) => {
          const data = call[1] as Record<string, unknown>;
          return data.aiUsage !== undefined;
        },
      );
      expect(billingUpdateCall).toBeDefined();
      expect((billingUpdateCall![1] as Record<string, unknown>).aiUsage).toEqual({
        period: CURRENT_PERIOD,
        count: 4,
      });
    });
  });

  describe("Ownership", () => {
    it("throws permission-denied when user does not own job application", async () => {
      // Billing OK
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      // Job application belongs to different user
      mockGet.mockResolvedValueOnce(snap(true, { ...validJobApplication, userId: "other-user" }));

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      try {
        await callGenerate(request);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        const error = err as { code: string };
        expect(error.code).toBe("permission-denied");
      }

      // No AI call should have been made
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("throws permission-denied when user does not own resume", async () => {
      // Billing OK
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      // Job application OK
      mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
      // Resume belongs to different user
      mockGet.mockResolvedValueOnce(snap(true, { ...validResume, userId: "other-user" }));

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      try {
        await callGenerate(request);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        const error = err as { code: string };
        expect(error.code).toBe("permission-denied");
      }

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });

  describe("Validation", () => {
    it("throws when resume has no parsed text", async () => {
      // Billing OK
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      // Job application OK
      mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
      // Resume has no text
      mockGet.mockResolvedValueOnce(snap(true, { userId: USER_ID, text: null }));

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      await expect(callGenerate(request)).rejects.toThrow("Resume has not been parsed yet");
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("throws not-found when job application does not exist", async () => {
      // Billing OK
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      // Job application does not exist
      mockGet.mockResolvedValueOnce(snap(false));

      const request = authRequest(USER_ID, {
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      try {
        await callGenerate(request);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        const error = err as { code: string };
        expect(error.code).toBe("not-found");
      }

      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });
});

// ============================================================
// regenerateCoverLetter tests
// ============================================================

describe("regenerateCoverLetter orchestration", () => {
  describe("Allowance", () => {
    it("updates existing cover letter and counts a check on success", async () => {
      setupSuccessfulRegenerate();

      const request = authRequest(USER_ID, {
        coverLetterId: COVER_LETTER_ID,
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      const result = await callRegenerate(request);

      expect(result.body).toBe("Regenerated cover letter body");

      // Transaction ran exactly once
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);

      // Should use update (not create) for existing cover letter
      expect(mockTransactionCreate).not.toHaveBeenCalled();

      // Should have 2 updates: cover letter body + AI check count
      expect(mockTransactionUpdate).toHaveBeenCalledTimes(2);

      const coverLetterUpdateCall = mockTransactionUpdate.mock.calls.find(
        (call: unknown[]) => {
          const data = call[1] as Record<string, unknown>;
          return data.body !== undefined;
        },
      );
      expect(coverLetterUpdateCall).toBeDefined();
      expect((coverLetterUpdateCall![1] as Record<string, unknown>).body).toBe("Regenerated cover letter body");
    });

    it("does not count a check when AI fails during regeneration", async () => {
      // Billing OK
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      // Cover letter ownership OK
      mockGet.mockResolvedValueOnce(snap(true, { userId: USER_ID }));
      // Job application OK
      mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
      // Resume OK
      mockGet.mockResolvedValueOnce(snap(true, validResume));
      // Prompt template OK
      mockGet.mockResolvedValueOnce(snap(true, validPromptTemplate));
      // AI fails
      mockGenerate.mockRejectedValueOnce(new Error("AI timeout"));

      const request = authRequest(USER_ID, {
        coverLetterId: COVER_LETTER_ID,
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      await expect(callRegenerate(request)).rejects.toThrow("AI timeout");
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("aborts when the allowance runs out between pre-check and transaction", async () => {
      // Billing pre-check passes
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      // Cover letter ownership OK
      mockGet.mockResolvedValueOnce(snap(true, { userId: USER_ID }));
      // Job application OK
      mockGet.mockResolvedValueOnce(snap(true, validJobApplication));
      // Resume OK
      mockGet.mockResolvedValueOnce(snap(true, validResume));
      // Prompt template OK
      mockGet.mockResolvedValueOnce(snap(true, validPromptTemplate));
      // AI succeeds
      mockGenerate.mockResolvedValueOnce({ text: "New body" });

      // Transaction: another request used the last check
      mockRunTransaction.mockImplementationOnce(async (callback: Function) => {
        mockTransactionGet.mockResolvedValueOnce(snap(true, exhaustedBillingProfile));
        await callback({
          get: mockTransactionGet,
          create: mockTransactionCreate,
          update: mockTransactionUpdate,
        });
      });

      const request = authRequest(USER_ID, {
        coverLetterId: COVER_LETTER_ID,
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      await expect(callRegenerate(request)).rejects.toMatchObject({ details: { code: "ai-limit-reached" } });
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Ownership", () => {
    it("throws permission-denied when user does not own cover letter", async () => {
      // Billing OK
      mockGet.mockResolvedValueOnce(snap(true, validBillingProfile));
      // Cover letter belongs to different user
      mockGet.mockResolvedValueOnce(snap(true, { userId: "other-user" }));

      const request = authRequest(USER_ID, {
        coverLetterId: COVER_LETTER_ID,
        jobApplicationId: JOB_APP_ID,
        resumeId: RESUME_ID,
      });

      try {
        await callRegenerate(request);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        const error = err as { code: string };
        expect(error.code).toBe("permission-denied");
      }

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });
});
