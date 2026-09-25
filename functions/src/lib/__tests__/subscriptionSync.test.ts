import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { subscriptionProfileFields } from "../subscriptionSync";

const subscription = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1790000000 }] },
    ...overrides,
  }) as unknown as Stripe.Subscription;

describe("subscriptionProfileFields", () => {
  it("maps an active subscription", () => {
    expect(subscriptionProfileFields(subscription())).toEqual({
      subscriptionStatus: "active",
      stripeSubscriptionId: "sub_1",
      currentPeriodEnd: new Date(1790000000 * 1000),
      cancelAtPeriodEnd: false,
    });
  });

  it("carries cancel at period end", () => {
    expect(
      subscriptionProfileFields(subscription({ cancel_at_period_end: true })).cancelAtPeriodEnd,
    ).toBe(true);
  });

  it("returns null when no period end is known", () => {
    expect(
      subscriptionProfileFields(subscription({ items: { data: [] } })).currentPeriodEnd,
    ).toBeNull();
  });
});
