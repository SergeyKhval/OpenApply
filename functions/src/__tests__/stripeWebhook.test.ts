import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSet = vi.fn();
const mockCollectionGroupGet = vi.fn();
const mockCollectionGroupWhere = vi.fn();
const mockRetrieve = vi.fn();
const mockConstructEvent = vi.fn();
const profileRefs: Record<string, { path: string; set: typeof mockSet }> = {};

const profileRef = (uid: string) => {
  profileRefs[uid] ??= { path: `users/${uid}/billingProfile/profile`, set: mockSet };
  return profileRefs[uid];
};

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: (uid: string) => ({
        collection: () => ({ doc: () => profileRef(uid) }),
      }),
    }),
    collectionGroup: () => ({
      where: (...args: unknown[]) => {
        mockCollectionGroupWhere(...args);
        return { limit: () => ({ get: mockCollectionGroupGet }) };
      },
    }),
  }),
  FieldValue: {
    serverTimestamp: () => "mock-timestamp",
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineString: (name: string) => ({
    value: () => (name === "STRIPE_API_KEY" ? "sk_test_key" : "whsec_test"),
  }),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    webhooks = {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    };
    subscriptions = {
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
    };
  },
}));

vi.mock("firebase-functions/v2/https", () => ({
  onRequest: (fn: Function) => fn,
}));

import { stripeWebhook } from "../stripeWebhook";

const stripeSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  cancel_at_period_end: false,
  metadata: { firebaseUid: "user-1" },
  items: { data: [{ current_period_end: 1790000000 }] },
  ...overrides,
});

describe("stripeWebhook", () => {
  let mockReq: { headers: Record<string, string>; rawBody: string };
  let mockRes: {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { headers: { "stripe-signature": "valid-sig" }, rawBody: "raw-body" };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  const callWebhook = () => (stripeWebhook as unknown as Function)(mockReq, mockRes);

  const givenEvent = (type: string, object: Record<string, unknown>) =>
    mockConstructEvent.mockReturnValue({ id: "evt_1", type, data: { object } });

  it("rejects missing signature", async () => {
    mockReq.headers = {};
    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith("Missing signature");
  });

  it("rejects invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    await callWebhook();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining("Webhook Error"));
  });

  it("syncs the subscription as Stripe has it now, not as the event says", async () => {
    givenEvent("customer.subscription.updated", stripeSubscription({ status: "active" }));
    mockRetrieve.mockResolvedValue(stripeSubscription({ status: "canceled" }));

    await callWebhook();

    expect(mockRetrieve).toHaveBeenCalledWith("sub_1");
    expect(mockSet).toHaveBeenCalledWith(
      {
        subscriptionStatus: "canceled",
        stripeSubscriptionId: "sub_1",
        currentPeriodEnd: new Date(1790000000 * 1000),
        cancelAtPeriodEnd: false,
        lastStripeEventId: "evt_1",
        updatedAt: "mock-timestamp",
      },
      { merge: true },
    );
    expect(profileRefs["user-1"]).toBeDefined();
    expect(mockCollectionGroupGet).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it.each(["customer.subscription.created", "customer.subscription.deleted"])(
    "handles %s",
    async (type) => {
      givenEvent(type, stripeSubscription());
      mockRetrieve.mockResolvedValue(stripeSubscription());

      await callWebhook();

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    },
  );

  it("falls back to the customer ID when the subscription has no uid", async () => {
    givenEvent("customer.subscription.updated", stripeSubscription());
    mockRetrieve.mockResolvedValue(stripeSubscription({ metadata: {} }));
    const fallbackSet = vi.fn();
    mockCollectionGroupGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: { set: fallbackSet } }],
    });

    await callWebhook();

    expect(mockCollectionGroupWhere).toHaveBeenCalledWith("stripeCustomerId", "==", "cus_1");
    expect(fallbackSet).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionStatus: "active" }),
      { merge: true },
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it("acknowledges subscriptions for unknown customers without writing", async () => {
    givenEvent("customer.subscription.updated", stripeSubscription());
    mockRetrieve.mockResolvedValue(stripeSubscription({ metadata: {} }));
    mockCollectionGroupGet.mockResolvedValue({ empty: true, docs: [] });

    await callWebhook();

    expect(mockSet).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it("syncs on a completed subscription checkout", async () => {
    givenEvent("checkout.session.completed", {
      id: "cs_1",
      mode: "subscription",
      subscription: "sub_1",
    });
    mockRetrieve.mockResolvedValue(stripeSubscription());

    await callWebhook();

    expect(mockRetrieve).toHaveBeenCalledWith("sub_1");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionStatus: "active" }),
      { merge: true },
    );
  });

  it("ignores one-off payment checkouts", async () => {
    givenEvent("checkout.session.completed", { id: "cs_1", mode: "payment" });

    await callWebhook();

    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it("ignores unrelated events", async () => {
    givenEvent("invoice.paid", { id: "in_1" });

    await callWebhook();

    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
  });

  it("returns 500 so Stripe retries when the sync fails", async () => {
    givenEvent("customer.subscription.updated", stripeSubscription());
    mockRetrieve.mockRejectedValue(new Error("stripe down"));

    await callWebhook();

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
