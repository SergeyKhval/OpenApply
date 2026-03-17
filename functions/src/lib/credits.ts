import { HttpsError } from "firebase-functions/v2/https";

/**
 * Validates that the user has enough credits for the requested action.
 * Throws failed-precondition with insufficient-credits detail if not.
 */
export function validateCreditBalance(
  balance: number,
  cost: number,
  actionLabel?: string,
): void {
  if (balance < cost) {
    const message = actionLabel
      ? `You need at least ${cost} coins to ${actionLabel}.`
      : `You need at least ${cost} coins for this action.`;
    throw new HttpsError("failed-precondition", message, {
      code: "insufficient-credits",
    });
  }
}

/**
 * Maps a Stripe price ID to its credit amount.
 * Throws if the price ID is not found in the pack map.
 */
export function calculateWebhookCredits(
  priceId: string,
  packMap: Record<string, number>,
): number {
  const credits = packMap[priceId];
  if (credits === undefined) {
    throw new Error(`Unknown credit pack price ID: "${priceId}"`);
  }
  return credits;
}
