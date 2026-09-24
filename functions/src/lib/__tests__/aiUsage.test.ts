import { describe, it, expect, vi, beforeEach } from "vitest";

const mockProfileGet = vi.fn();
const profileRef = { id: "profile", get: mockProfileGet };

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({ doc: () => profileRef }),
      }),
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
  return { HttpsError };
});

import { assertAiAllowance, chargeAiCheck } from "../aiUsage";

const now = new Date("2026-09-24T10:00:00Z");
const snapshot = (data: Record<string, unknown> | null) => ({
  exists: data !== null,
  data: () => data ?? undefined,
});
const exhausted = { aiUsage: { period: "2026-09", count: 15 }, bonusChecks: 0 };

describe("assertAiAllowance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves when checks are left", async () => {
    mockProfileGet.mockResolvedValue(snapshot({ bonusChecks: 0 }));
    await expect(assertAiAllowance("user-1", now)).resolves.toBeUndefined();
  });

  it("rejects with ai-limit-reached when the allowance is used up", async () => {
    mockProfileGet.mockResolvedValue(snapshot(exhausted));
    await expect(assertAiAllowance("user-1", now)).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "You've used your 15 free AI checks this month. They reset on October 1.",
      details: {
        code: "ai-limit-reached",
        plan: "free",
        limit: 15,
        resetsAt: "2026-10-01T00:00:00.000Z",
      },
    });
  });

  it("words the pro limit without 'free'", async () => {
    mockProfileGet.mockResolvedValue(
      snapshot({ subscriptionStatus: "active", aiUsage: { period: "2026-09", count: 150 } }),
    );
    await expect(assertAiAllowance("user-1", now)).rejects.toMatchObject({
      message: "You've used your 150 AI checks this month. They reset on October 1.",
      details: { plan: "pro", limit: 150 },
    });
  });

  it("rejects when the billing profile is missing", async () => {
    mockProfileGet.mockResolvedValue(snapshot(null));
    await expect(assertAiAllowance("user-1", now)).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});

describe("chargeAiCheck", () => {
  const transaction = { get: vi.fn(), update: vi.fn() };

  beforeEach(() => vi.clearAllMocks());

  it("records the check and materializes legacy bonus", async () => {
    transaction.get.mockResolvedValue(snapshot({ currentBalance: 100 }));
    await chargeAiCheck(transaction as never, "user-1", now);
    expect(transaction.get).toHaveBeenCalledWith(profileRef);
    expect(transaction.update).toHaveBeenCalledWith(profileRef, {
      aiUsage: { period: "2026-09", count: 1 },
      bonusChecks: 10,
      updatedAt: "mock-ts",
    });
  });

  it("throws and writes nothing when nothing is left", async () => {
    transaction.get.mockResolvedValue(snapshot(exhausted));
    await expect(chargeAiCheck(transaction as never, "user-1", now)).rejects.toMatchObject({
      details: { code: "ai-limit-reached" },
    });
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
