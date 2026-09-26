import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const mockProfileGet = vi.fn();
const mockProfileSet = vi.fn();
const mockCustomersCreate = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({ doc: () => ({ get: mockProfileGet, set: mockProfileSet }) }),
      }),
    }),
  }),
  FieldValue: { serverTimestamp: () => "mock-ts" },
}));

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { HttpsError };
});

import { safeReturnUrl, getBillingProfileOrThrow, ensureStripeCustomerId } from "../billingProfile";

const fallback = "https://openapply.app/app/jobs";
const stripeClient = { customers: { create: mockCustomersCreate } } as unknown as Stripe;

describe("safeReturnUrl", () => {
  it.each([
    "https://openapply.app/app/jobs?dialog-name=checkout-success",
    "https://www.openapply.app/app/",
    "http://localhost:5173/app/dashboard/applications",
    "http://127.0.0.1:5180/app/",
  ])("keeps %s", (url) => {
    expect(safeReturnUrl(url, fallback)).toBe(url);
  });

  it.each([
    "https://evil.example/phish",
    "https://openapply.app.evil.example/",
    "javascript:alert(1)",
    "not a url",
    "",
    undefined,
  ])("replaces %s with the fallback", (url) => {
    expect(safeReturnUrl(url, fallback)).toBe(fallback);
  });
});

describe("getBillingProfileOrThrow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the profile fields when the doc exists, even without a Stripe customer yet", async () => {
    mockProfileGet.mockResolvedValue({
      exists: true,
      data: () => ({ subscriptionStatus: "active" }),
    });
    await expect(getBillingProfileOrThrow("user-1")).resolves.toEqual({
      subscriptionStatus: "active",
    });
  });

  it("throws failed-precondition when the profile doc doesn't exist", async () => {
    mockProfileGet.mockResolvedValue({ exists: false, data: () => undefined });
    await expect(getBillingProfileOrThrow("user-1")).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});

describe("ensureStripeCustomerId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the existing customer id without calling Stripe", async () => {
    const id = await ensureStripeCustomerId(
      "user-1",
      { stripeCustomerId: "cus_1" },
      "a@b.com",
      stripeClient,
    );
    expect(id).toBe("cus_1");
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockProfileSet).not.toHaveBeenCalled();
  });

  it("creates and persists a Stripe customer when the profile has none yet", async () => {
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });

    const id = await ensureStripeCustomerId("user-1", {}, "a@b.com", stripeClient);

    expect(id).toBe("cus_new");
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "a@b.com",
      metadata: { firebaseUid: "user-1" },
    });
    expect(mockProfileSet).toHaveBeenCalledWith(
      { stripeCustomerId: "cus_new", updatedAt: "mock-ts" },
      { merge: true },
    );
  });
});
