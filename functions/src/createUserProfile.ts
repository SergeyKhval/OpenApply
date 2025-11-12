import { user } from "firebase-functions/v1/auth";
import { defineString } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { Resend } from "resend";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");
const RESEND_API_KEY = defineString("RESEND_API_KEY");

const db = getFirestore();

export const createUserProfile = user().onCreate(async (user) => {
  const stripeClient = new Stripe(STRIPE_API_KEY.value());
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

  try {
    const customer = await stripeClient.customers.create({ email: user.email });
    const userRef = db.collection("users").doc(user.uid);
    const billingProfileRef = userRef
      .collection("billingProfile")
      .doc("profile");

    await userRef.set(
      {
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await billingProfileRef.set({
      stripeCustomerId: customer.id,
      currentBalance: 100,
      lifetimeCreditsPurchased: 0,
      welcomeCreditsGrantedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(`Failed to create user profile for ${user.uid}:`, error);
    throw error;
  }
});
