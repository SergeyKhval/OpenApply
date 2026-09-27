import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type Stripe from "stripe";

export const APP_HOME_URL = "https://openapply.app/app/jobs";

const ALLOWED_ORIGINS = new Set([
  "https://openapply.app",
  "https://www.openapply.app",
]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Keeps Stripe redirects on our own site; anything else gets the fallback. */
export function safeReturnUrl(url: unknown, fallback: string): string {
  if (typeof url !== "string" || !url) return fallback;
  try {
    const parsed = new URL(url);
    const isLocal =
      parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
    return ALLOWED_ORIGINS.has(parsed.origin) || isLocal ? url : fallback;
  } catch {
    return fallback;
  }
}

export const billingProfileRef = (userId: string) =>
  getFirestore()
    .collection("users")
    .doc(userId)
    .collection("billingProfile")
    .doc("profile");

/** Defaults for a brand-new or self-healed billing profile: free tier, no Stripe customer yet. */
export const DEFAULT_BILLING_PROFILE = {
  stripeCustomerId: null as string | null,
  aiUsage: null,
  bonusChecks: 0,
  subscriptionStatus: null as string | null,
};

export type StripeBillingProfile = {
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
};

export async function getBillingProfileOrThrow(
  userId: string,
): Promise<StripeBillingProfile> {
  const snapshot = await billingProfileRef(userId).get();
  if (!snapshot.exists) {
    throw new HttpsError("failed-precondition", "Billing profile not found");
  }
  return snapshot.data() as StripeBillingProfile;
}

/**
 * Returns the user's Stripe customer id, creating one now if signup-time
 * creation failed or Stripe wasn't configured yet (self-hosters, outages).
 */
export async function ensureStripeCustomerId(
  userId: string,
  profile: StripeBillingProfile,
  email: string | undefined,
  stripeClient: Stripe,
): Promise<string> {
  if (profile.stripeCustomerId) {
    return profile.stripeCustomerId;
  }

  const customer = await stripeClient.customers.create({
    email,
    metadata: { firebaseUid: userId },
  });

  await billingProfileRef(userId).set(
    { stripeCustomerId: customer.id, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return customer.id;
}
