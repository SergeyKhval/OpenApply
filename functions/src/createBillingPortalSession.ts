import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import Stripe from "stripe";
import {
  APP_HOME_URL,
  ensureStripeCustomerId,
  getBillingProfileOrThrow,
  safeReturnUrl,
} from "./lib/billingProfile";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");

/** Opens the Stripe customer portal (cancel, change card, invoices). */
export const createBillingPortalSession = onCall<{ return_url?: string }>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const billingProfile = await getBillingProfileOrThrow(request.auth.uid);
      const stripeClient = new Stripe(STRIPE_API_KEY.value());
      const stripeCustomerId = await ensureStripeCustomerId(
        request.auth.uid,
        billingProfile,
        request.auth.token?.email,
        stripeClient,
      );
      const session = await stripeClient.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: safeReturnUrl(request.data?.return_url, APP_HOME_URL),
      });

      return { url: session.url };
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to open billing portal");
    }
  },
);
