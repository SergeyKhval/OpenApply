import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { subscriptionProfileFields } from "./lib/subscriptionSync";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");
const STRIPE_WEBHOOK_SECRET = defineString("STRIPE_WEBHOOK_SECRET");

const db = getFirestore();

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || !session.subscription) return null;
    return typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;
  }
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    return (event.data.object as Stripe.Subscription).id;
  }
  return null;
}

async function billingProfileRefFor(subscription: Stripe.Subscription) {
  const uid = subscription.metadata?.firebaseUid;
  if (uid) {
    return db
      .collection("users")
      .doc(uid)
      .collection("billingProfile")
      .doc("profile");
  }

  // Subscriptions created outside our checkout have no uid metadata.
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const snapshot = await db
    .collectionGroup("billingProfile")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].ref;
}

export const stripeWebhook = onRequest(async (req, res) => {
  const stripeClient = new Stripe(STRIPE_API_KEY.value());
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("Missing stripe-signature header");
    res.status(400).send("Missing signature");
    return;
  }

  let event: Stripe.Event;

  try {
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

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    // Always read the current state from Stripe: events can arrive out of
    // order or twice, and the latest subscription is the only safe source.
    const subscription =
      await stripeClient.subscriptions.retrieve(subscriptionId);
    const profileRef = await billingProfileRefFor(subscription);

    if (!profileRef) {
      console.warn(
        `No billing profile for subscription ${subscription.id}, ignoring`,
      );
      res.status(200).json({ received: true });
      return;
    }

    const fields = subscriptionProfileFields(subscription);
    await profileRef.set(
      {
        ...fields,
        lastStripeEventId: event.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(
      `Synced subscription ${subscription.id} (${fields.subscriptionStatus}) from ${event.type}`,
    );
  } catch (error) {
    console.error("Error syncing subscription:", error);
    res.status(500).send("Internal server error");
    return;
  }

  res.status(200).json({ received: true });
});
