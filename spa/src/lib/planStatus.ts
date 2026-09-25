// Plain-language lines for Settings > Plan and AI usage.

type DateLike = { toDate(): Date };

export type SubscriptionInfo = {
  subscriptionStatus?: string | null;
  currentPeriodEnd?: DateLike | null;
  cancelAtPeriodEnd?: boolean;
};

const formatDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/** What happens next with a Pro subscription, or null when there's nothing to say. */
export function proStatusLine(billing: SubscriptionInfo | null | undefined): string | null {
  if (!billing) return null;
  if (billing.subscriptionStatus === "past_due") {
    return "Your last payment failed. Update your card to keep Pro.";
  }
  const end = billing.currentPeriodEnd?.toDate();
  if (!end) return null;
  if (billing.cancelAtPeriodEnd) {
    return `Ends on ${formatDay(end)}. You won't be charged again.`;
  }
  return `Renews on ${formatDay(end)} for $9.`;
}

export function resetLine(resetsAt: Date, remaining: number): string {
  return `Resets on ${formatDay(resetsAt)}. ${remaining} left.`;
}
