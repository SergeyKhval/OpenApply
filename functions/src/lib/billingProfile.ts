import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

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

export type StripeBillingProfile = {
  stripeCustomerId: string;
  subscriptionStatus?: string | null;
};

export async function getBillingProfileOrThrow(
  userId: string,
): Promise<StripeBillingProfile> {
  const snapshot = await getFirestore()
    .collection("users")
    .doc(userId)
    .collection("billingProfile")
    .doc("profile")
    .get();

  const profile = snapshot.exists ? snapshot.data() : undefined;
  if (!profile?.stripeCustomerId) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have a Stripe customer ID",
    );
  }
  return profile as StripeBillingProfile;
}
