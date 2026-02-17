import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockTransactionGet = vi.fn();
const mockTransactionUpdate = vi.fn();
const mockRunTransaction = vi.fn();
const mockBillingGet = vi.fn();
const mockCollectionGroupGet = vi.fn();
const mockListLineItems = vi.fn();
const mockConstructEvent = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collectionGroup: () => ({
      where: () => ({
        limit: () => ({
          get: mockCollectionGroupGet,
        }),
      }),
    }),
    runTransaction: (fn: Function) => mockRunTransaction(fn),
  }),
  FieldValue: {
    increment: (n: number) => ({ _increment: n }),
    serverTimestamp: () => "mock-timestamp",
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineString: (name: string) => ({
    value: () => name === "STRIPE_API_KEY" ? "sk_test_key" : "whsec_test",
  }),
}));

vi.mock("stripe", () => {
  return {
    default: class Stripe {
      webhooks = {
        constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
      };
      checkout = {
        sessions: {
          listLineItems: (...args: unknown[]) => mockListLineItems(...args),
        },
      };
    },
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onRequest: (fn: Function) => fn,
}));

import { stripeWebhook } from "../stripeWebhook";

describe("stripeWebhook", () => {
  let mockReq: {
    headers: Record<string, string>;
    rawBody: string;
  };
  let mockRes: {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      headers: {},
      rawBody: "raw-body",
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  const callWebhook = () =>
    (stripeWebhook as unknown as Function)(mockReq, mockRes);

  it("rejects missing signature", async () => {
    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith("Missing signature");
  });

  it("rejects invalid signature", async () => {
    mockReq.headers["stripe-signature"] = "invalid-sig";
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith(
      expect.stringContaining("Webhook Error"),
    );
  });

  it("rejects unknown price IDs", async () => {
    mockReq.headers["stripe-signature"] = "valid-sig";
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          customer: "cus_123",
        },
      },
    });
    mockListLineItems.mockResolvedValue({
      data: [{ price: { id: "price_unknown" } }],
    });

    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith("Unknown credit pack");
  });

  it("processes valid checkout with correct credit increment", async () => {
    mockReq.headers["stripe-signature"] = "valid-sig";
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          customer: "cus_123",
        },
      },
    });
    mockListLineItems.mockResolvedValue({
      data: [{ price: { id: "price_1SJE8pAZ6qTVMaZC4YZ6FC0m" } }],
    });

    const mockBillingDocRef = { parent: { parent: { id: "user-1" } } };
    mockCollectionGroupGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: mockBillingDocRef }],
    });

    mockRunTransaction.mockImplementation(async (fn: Function) => {
      const transaction = {
        get: mockTransactionGet.mockResolvedValue({
          get: () => null, // lastCheckoutSessionId doesn't match
        }),
        update: mockTransactionUpdate,
      };
      await fn(transaction);
    });

    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      mockBillingDocRef,
      expect.objectContaining({
        currentBalance: { _increment: 100 },
        lifetimeCreditsPurchased: { _increment: 100 },
        lastCheckoutSessionId: "cs_123",
      }),
    );
  });

  it("skips duplicate session IDs (idempotency)", async () => {
    mockReq.headers["stripe-signature"] = "valid-sig";
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_already_processed",
          customer: "cus_123",
        },
      },
    });
    mockListLineItems.mockResolvedValue({
      data: [{ price: { id: "price_1SJE8pAZ6qTVMaZC4YZ6FC0m" } }],
    });

    const mockBillingDocRef = { parent: { parent: { id: "user-1" } } };
    mockCollectionGroupGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: mockBillingDocRef }],
    });

    mockRunTransaction.mockImplementation(async (fn: Function) => {
      const transaction = {
        get: mockTransactionGet.mockResolvedValue({
          get: (field: string) =>
            field === "lastCheckoutSessionId" ? "cs_already_processed" : null,
        }),
        update: mockTransactionUpdate,
      };
      await fn(transaction);
    });

    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    // Transaction update should NOT be called due to idempotency check
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it("returns 200 for non-checkout events", async () => {
    mockReq.headers["stripe-signature"] = "valid-sig";
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: {} },
    });

    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
  });
});
