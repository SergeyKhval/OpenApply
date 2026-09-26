import { describe, it, expect, vi, beforeEach } from "vitest";

const mockContactsCreate = vi.fn();
vi.mock("resend", () => {
  const ResendMock = function (this: unknown) {
    (this as { contacts: { create: typeof mockContactsCreate } }).contacts = {
      create: mockContactsCreate,
    };
  };
  return { Resend: ResendMock };
});

const mockCustomersCreate = vi.fn();
vi.mock("stripe", () => {
  const StripeMock = function (this: unknown) {
    (this as { customers: { create: typeof mockCustomersCreate } }).customers = {
      create: mockCustomersCreate,
    };
  };
  return { default: StripeMock };
});

vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "test-key" }),
}));

vi.mock("firebase-functions/v1/auth", () => ({
  user: () => ({ onCreate: (fn: unknown) => fn }),
}));

const mockUserSet = vi.fn();
const mockBillingProfileSet = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        set: mockUserSet,
        collection: () => ({ doc: () => ({ set: mockBillingProfileSet }) }),
      }),
    }),
  }),
  FieldValue: { serverTimestamp: () => "mock-ts" },
}));

import { createUserProfile } from "../createUserProfile";

const trigger = createUserProfile as unknown as (user: {
  uid: string;
  email?: string;
  displayName?: string;
}) => Promise<void>;

const authUser = (overrides: Partial<{ uid: string; email?: string; displayName?: string }> = {}) => ({
  uid: "user-1",
  email: "new@example.com",
  displayName: "Ada Lovelace",
  ...overrides,
});

describe("createUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });
  });

  it("creates the user doc and a free-tier billing profile with the Stripe customer attached", async () => {
    await trigger(authUser());

    expect(mockUserSet).toHaveBeenCalledWith(
      { createdAt: "mock-ts", updatedAt: "mock-ts" },
      { merge: true },
    );
    expect(mockBillingProfileSet).toHaveBeenCalledWith({
      stripeCustomerId: "cus_new",
      aiUsage: null,
      bonusChecks: 0,
      subscriptionStatus: null,
      createdAt: "mock-ts",
      updatedAt: "mock-ts",
    });
  });

  it("still creates a working free-tier profile when Stripe customer creation fails", async () => {
    mockCustomersCreate.mockRejectedValue(new Error("StripeAuthenticationError: Invalid API Key provided"));

    await expect(trigger(authUser())).resolves.toBeUndefined();

    expect(mockUserSet).toHaveBeenCalled();
    expect(mockBillingProfileSet).toHaveBeenCalledWith({
      stripeCustomerId: null,
      aiUsage: null,
      bonusChecks: 0,
      subscriptionStatus: null,
      createdAt: "mock-ts",
      updatedAt: "mock-ts",
    });
  });

  it("still creates a profile when the Resend contact call fails", async () => {
    mockContactsCreate.mockRejectedValue(new Error("resend down"));

    await expect(trigger(authUser())).resolves.toBeUndefined();

    expect(mockBillingProfileSet).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: "cus_new" }),
    );
  });
});
