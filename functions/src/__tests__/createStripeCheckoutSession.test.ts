import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockProfileGet = vi.fn();
const mockProfileSet = vi.fn();
const mockSessionsCreate = vi.fn();
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
    checkout = {
      sessions: { create: (...args: unknown[]) => mockSessionsCreate(...args) },
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

import { createStripeCheckoutSession } from "../createStripeCheckoutSession";

const call = createStripeCheckoutSession as unknown as (req: unknown) => Promise<{ url: string }>;
const SUCCESS = "https://openapply.app/app/jobs?dialog-name=checkout-success";
const CANCEL = "https://openapply.app/app/jobs?dialog-name=checkout-canceled";

const request = (
  data: Record<string, unknown> = {},
  uid: string | null = "user-1",
  email?: string,
) => ({
  auth: uid ? { uid, token: { email } } : undefined,
  data: { success_url: SUCCESS, cancel_url: CANCEL, ...data },
});

const profile = (data: Record<string, unknown> | null) => ({
  exists: data !== null,
  data: () => data ?? undefined,
});

describe("createStripeCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_pro_test");
    mockSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires sign-in", async () => {
    await expect(call(request({}, null))).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("fails when the billing profile doc doesn't exist", async () => {
    mockProfileGet.mockResolvedValue(profile(null));
    await expect(call(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("lazily creates a Stripe customer when the profile has none yet", async () => {
    mockProfileGet.mockResolvedValue(profile({}));
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });

    await expect(call(request({}, "user-1", "new@example.com"))).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test",
    });

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "new@example.com",
      metadata: { firebaseUid: "user-1" },
    });
    expect(mockProfileSet).toHaveBeenCalledWith(
      { stripeCustomerId: "cus_new", updatedAt: "mock-ts" },
      { merge: true },
    );
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_new" }),
    );
  });

  it("says Pro isn't available until the price is configured", async () => {
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "");
    mockProfileGet.mockResolvedValue(profile({ stripeCustomerId: "cus_1" }));

    await expect(call(request())).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Pro isn't available yet. Try again later.",
    });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses a second subscription for a Pro user", async () => {
    mockProfileGet.mockResolvedValue(
      profile({ stripeCustomerId: "cus_1", subscriptionStatus: "active" }),
    );
    await expect(call(request())).rejects.toMatchObject({ code: "already-exists" });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a Pro subscription checkout with Stripe Tax", async () => {
    mockProfileGet.mockResolvedValue(profile({ stripeCustomerId: "cus_1" }));

    await expect(call(request())).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_1",
      client_reference_id: "user-1",
      line_items: [{ price: "price_pro_test", quantity: 1 }],
      subscription_data: { metadata: { firebaseUid: "user-1" } },
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      success_url: SUCCESS,
      cancel_url: CANCEL,
    });
  });

  it("lets a canceled subscriber subscribe again", async () => {
    mockProfileGet.mockResolvedValue(
      profile({ stripeCustomerId: "cus_1", subscriptionStatus: "canceled" }),
    );
    await call(request());
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("gives an old client's coin pack request a Pro checkout", async () => {
    mockProfileGet.mockResolvedValue(profile({ stripeCustomerId: "cus_1" }));

    await call(request({ priceId: "price_1SJE8pAZ6qTVMaZC4YZ6FC0m" }));

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro_test", quantity: 1 }],
      }),
    );
  });

  it("does not redirect to other sites after checkout", async () => {
    mockProfileGet.mockResolvedValue(profile({ stripeCustomerId: "cus_1" }));

    await call(request({ success_url: "https://evil.example/", cancel_url: "" }));

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "https://openapply.app/app/jobs?dialog-name=checkout-success",
        cancel_url: "https://openapply.app/app/jobs?dialog-name=checkout-canceled",
      }),
    );
  });
});
