import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { CREDIT_PACKS_MAP as CREDIT_PACKS } from "./constants/creditPacks";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");

const db = getFirestore();

export const createStripeCheckoutSession = onCall<{
  priceId: string;
  success_url: string;
  cancel_url: string;
}>(async (request) => {
  const stripeClient = new Stripe(STRIPE_API_KEY.value());

  const { priceId, success_url = "", cancel_url = "" } = request.data;

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!priceId || !CREDIT_PACKS[priceId]) {
    throw new HttpsError("invalid-argument", "Unknown credit pack requested");
  }

  try {
    // Get the user's Stripe customer ID
    const billingProfileRef = db
      .collection("users")
      .doc(request.auth.uid)
      .collection("billingProfile")
      .doc("profile");
    const billingProfileSnap = await billingProfileRef.get();

    if (!billingProfileSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Billing profile not initialized",
      );
    }

    const billingProfile = billingProfileSnap.data();

    if (!billingProfile?.stripeCustomerId) {
      throw new HttpsError(
        "failed-precondition",
        "User does not have a Stripe customer ID",
      );
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      customer: billingProfile.stripeCustomerId,
      customer_update: { address: "auto" },
      client_reference_id: request.auth.uid,
      metadata: {
        creditPackPriceId: priceId,
      },
      line_items: [{ price: priceId, quantity: 1 }],
      automatic_tax: { enabled: true },
      success_url,
      cancel_url,
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
