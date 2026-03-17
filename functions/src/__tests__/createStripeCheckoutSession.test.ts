import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDocGet = vi.fn();
const mockSessionCreate = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            get: mockDocGet,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("firebase-functions/params", () => ({
  defineString: () => ({
    value: () => "sk_test_key",
  }),
}));

vi.mock("stripe", () => {
  return {
    default: class Stripe {
      checkout = {
        sessions: {
          create: (...args: unknown[]) => mockSessionCreate(...args),
        },
      };
    },
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (fn: Function) => fn,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { createStripeCheckoutSession } from "../createStripeCheckoutSession";

const VALID_PRICE_ID = "price_1SJE8pAZ6qTVMaZC4YZ6FC0m";

const callFunction = (overrides: {
  auth?: { uid: string } | null;
  data?: Record<string, unknown>;
}) => {
  const request = {
    auth: overrides.auth !== undefined ? overrides.auth : { uid: "user-123" },
    data: {
      priceId: VALID_PRICE_ID,
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      ...overrides.data,
    },
  };
  return (createStripeCheckoutSession as unknown as Function)(request);
};

describe("createStripeCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("rejects unauthenticated requests", async () => {
      await expect(callFunction({ auth: null })).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });

    it("rejects unknown priceId", async () => {
      await expect(
        callFunction({ data: { priceId: "price_unknown" } }),
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("rejects missing priceId", async () => {
      await expect(
        callFunction({ data: { priceId: "" } }),
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("rejects when billing profile does not exist", async () => {
      mockDocGet.mockResolvedValue({ exists: false });

      await expect(callFunction({})).rejects.toMatchObject({
        code: "failed-precondition",
        message: "Billing profile not initialized",
      });
    });

    it("rejects when billing profile has no stripeCustomerId", async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ someField: "value" }),
      });

      await expect(callFunction({})).rejects.toMatchObject({
        code: "failed-precondition",
        message: "User does not have a Stripe customer ID",
      });
    });
  });

  describe("happy path", () => {
    const STRIPE_CUSTOMER_ID = "cus_abc123";
    const SESSION_URL = "https://checkout.stripe.com/pay/cs_test_123";

    beforeEach(() => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ stripeCustomerId: STRIPE_CUSTOMER_ID }),
      });
      mockSessionCreate.mockResolvedValue({ url: SESSION_URL });
    });

    it("returns the Stripe checkout session URL", async () => {
      const result = await callFunction({});
      expect(result).toEqual({ url: SESSION_URL });
    });

    it("creates Stripe session with correct customer, price, and metadata", async () => {
      await callFunction({});

      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          customer: STRIPE_CUSTOMER_ID,
          client_reference_id: "user-123",
          metadata: { creditPackPriceId: VALID_PRICE_ID },
          line_items: [{ price: VALID_PRICE_ID, quantity: 1 }],
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel",
        }),
      );
    });
  });
});
