import { onRequest } from "firebase-functions/v2/https";
import {  defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { CREDIT_PACKS_MAP as CREDIT_PACKS } from "./constants/creditPacks";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");
const STRIPE_WEBHOOK_SECRET = defineString("STRIPE_WEBHOOK_SECRET");

const db = getFirestore();

export const stripeWebhook = onRequest(
  async (req, res) => {
    const stripeClient = new Stripe(STRIPE_API_KEY.value());
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("Missing stripe-signature header");
      res.status(400).send("Missing signature");
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripeClient.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value(),
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).send(`Webhook Error: ${err}`);
      return;
    }

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      try {
        // Get the customer ID from the session
        const customerId = session.customer as string;
        if (!customerId) {
          console.error("No customer ID in session");
          res.status(400).send("No customer ID");
          return;
        }

        const lineItems = await stripeClient.checkout.sessions.listLineItems(
          session.id,
          { limit: 1 },
        );

        const priceId = lineItems.data[0]?.price?.id;
        const credits = priceId ? CREDIT_PACKS[priceId] : undefined;

        if (!priceId || !credits) {
          console.error("Unable to determine credits for price", priceId);
          res.status(400).send("Unknown credit pack");
          return;
        }

        const billingProfilesSnapshot = await db
          .collectionGroup("billingProfile")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (billingProfilesSnapshot.empty) {
          console.error(`No billing profile found for customer ${customerId}`);
          res.status(404).send("Billing profile not found");
          return;
        }

        const billingDoc = billingProfilesSnapshot.docs[0];
        const userDocRef = billingDoc.ref.parent?.parent;

        if (!userDocRef) {
          console.error("Unable to resolve user document for billing profile");
          res.status(500).send("User reference missing");
          return;
        }

        await db.runTransaction(async (transaction) => {
          const billingSnapshot = await transaction.get(billingDoc.ref);
          if (billingSnapshot.get("lastCheckoutSessionId") === session.id) {
            return;
          }

          transaction.update(billingDoc.ref, {
            currentBalance: FieldValue.increment(credits),
            lifetimeCreditsPurchased: FieldValue.increment(credits),
            updatedAt: FieldValue.serverTimestamp(),
            lastCheckoutSessionId: session.id,
          });
        });

        console.log(
          `Added ${credits} credits to user ${userDocRef.id} for session ${session.id}`,
        );
      } catch (error) {
        console.error("Error processing checkout session:", error);
        res.status(500).send("Internal server error");
        return;
      }
    }

    res.status(200).json({ received: true });
  },
);
