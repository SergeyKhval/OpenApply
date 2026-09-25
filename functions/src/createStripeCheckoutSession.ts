import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import Stripe from "stripe";
import { isProStatus } from "./lib/aiAllowance";
import {
  APP_HOME_URL,
  getBillingProfileOrThrow,
  safeReturnUrl,
} from "./lib/billingProfile";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");

/**
 * Read from the environment at runtime rather than declared with
 * defineString: a declared param missing from the deploy dotenv file fails a
 * non-interactive `firebase deploy`, default or not. Unset means Pro isn't
 * on sale yet.
 */
const proPriceId = () => process.env.STRIPE_PRO_PRICE_ID || "";

/**
 * Starts a Stripe Checkout for the Pro subscription. The name is kept from the
 * coin pack era so deploys don't have to delete a function; a `priceId` sent
 * by old clients is ignored.
 */
export const createStripeCheckoutSession = onCall<{
  success_url?: string;
  cancel_url?: string;
  priceId?: string;
}>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const uid = request.auth.uid;
  const { success_url, cancel_url } = request.data ?? {};

  try {
    const billingProfile = await getBillingProfileOrThrow(uid);

    if (isProStatus(billingProfile.subscriptionStatus)) {
      throw new HttpsError("already-exists", "You're already on Pro");
    }

    const priceId = proPriceId();
    if (!priceId) {
      throw new HttpsError(
        "failed-precondition",
        "Pro isn't available yet. Try again later.",
      );
    }

    const stripeClient = new Stripe(STRIPE_API_KEY.value());
    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: billingProfile.stripeCustomerId,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { firebaseUid: uid } },
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      success_url: safeReturnUrl(
        success_url,
        `${APP_HOME_URL}?dialog-name=checkout-success`,
      ),
      cancel_url: safeReturnUrl(
        cancel_url,
        `${APP_HOME_URL}?dialog-name=checkout-canceled`,
      ),
    });

    return { url: session.url };
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to create checkout session");
  }
});
