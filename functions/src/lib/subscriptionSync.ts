import type Stripe from "stripe";

export type SubscriptionProfileFields = {
  subscriptionStatus: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Billing profile fields that mirror a Stripe subscription. */
export function subscriptionProfileFields(
  subscription: Stripe.Subscription,
): SubscriptionProfileFields {
  // Since the 2025-03 API the period lives on the items; older payloads had it
  // on the subscription itself.
  const periodEnd =
    subscription.items?.data?.[0]?.current_period_end ??
    (subscription as unknown as { current_period_end?: number })
      .current_period_end;

  return {
    subscriptionStatus: subscription.status,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}
