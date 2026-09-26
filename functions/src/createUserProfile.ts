import { user } from "firebase-functions/v1/auth";
import { defineString } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { Resend } from "resend";
import { billingProfileRef, DEFAULT_BILLING_PROFILE } from "./lib/billingProfile";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");
const RESEND_API_KEY = defineString("RESEND_API_KEY");

const db = getFirestore();

export const createUserProfile = user().onCreate(async (user) => {
  const resendClient = new Resend(RESEND_API_KEY.value());

  if (user.email) {
    const payload = {
      audienceId: "0378a299-a329-4239-944d-c8b787329e76",
      email: user.email,
      firstName: "",
      lastName: "",
    };
    const [firstName, lastName] = user.displayName?.split(" ") || ["", ""];
    payload.firstName = firstName;
    payload.lastName = lastName;

    try {
      await resendClient.contacts.create(payload);
    } catch (e) {
      console.error("Error adding contact to Resend:", e);
    }
  }

  // Stripe is optional (self-hosters, or a transient outage): a failure here
  // must never block the user doc or a working free-tier billing profile.
  let stripeCustomerId: string | null = null;
  try {
    const stripeClient = new Stripe(STRIPE_API_KEY.value());
    const customer = await stripeClient.customers.create({
      email: user.email,
      metadata: { firebaseUid: user.uid },
    });
    stripeCustomerId = customer.id;
  } catch (error) {
    console.error(`Failed to create Stripe customer for ${user.uid}:`, error);
  }

  const userRef = db.collection("users").doc(user.uid);
  await userRef.set(
    {
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await billingProfileRef(user.uid).set({
    ...DEFAULT_BILLING_PROFILE,
    stripeCustomerId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});
