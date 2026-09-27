import { describe, it, expect, vi, beforeEach } from "vitest";

const mockProfileGet = vi.fn();
const mockProfileSet = vi.fn();
const mockPortalCreate = vi.fn();
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

vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "sk_test_key" }),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    billingPortal = {
      sessions: { create: (...args: unknown[]) => mockPortalCreate(...args) },
    };
    customers = {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
    };
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
  return { HttpsError, onCall: (fn: unknown) => fn };
});

import { createBillingPortalSession } from "../createBillingPortalSession";

const call = createBillingPortalSession as unknown as (req: unknown) => Promise<{ url: string }>;
const RETURN = "https://openapply.app/app/jobs";

const request = (
  data: Record<string, unknown> = { return_url: RETURN },
  uid: string | null = "user-1",
  email?: string,
) => ({
  auth: uid ? { uid, token: { email } } : undefined,
  data,
});

describe("createBillingPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session/test" });
  });

  it("requires sign-in", async () => {
    await expect(call(request(undefined, null))).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("fails when the billing profile doc doesn't exist", async () => {
    mockProfileGet.mockResolvedValue({ exists: false, data: () => undefined });
    await expect(call(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("lazily creates a Stripe customer when the profile has none yet", async () => {
    mockProfileGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });

    await expect(call(request({ return_url: RETURN }, "user-1", "new@example.com"))).resolves.toEqual({
      url: "https://billing.stripe.com/p/session/test",
    });

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "new@example.com",
      metadata: { firebaseUid: "user-1" },
    });
    expect(mockProfileSet).toHaveBeenCalledWith(
      { stripeCustomerId: "cus_new", updatedAt: "mock-ts" },
      { merge: true },
    );
    expect(mockPortalCreate).toHaveBeenCalledWith({ customer: "cus_new", return_url: RETURN });
  });

  it("returns a portal session for the user's customer", async () => {
    mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ stripeCustomerId: "cus_1" }) });

    await expect(call(request())).resolves.toEqual({
      url: "https://billing.stripe.com/p/session/test",
    });
    expect(mockPortalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: RETURN });
  });

  it("only returns to our own site", async () => {
    mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ stripeCustomerId: "cus_1" }) });

    await call(request({ return_url: "https://evil.example/" }));

    expect(mockPortalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: RETURN });
  });
});
