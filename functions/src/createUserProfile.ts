import { user } from "firebase-functions/v1/auth";
import { getAuth } from "firebase-admin/auth";
import { defineString } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { onCall } from "firebase-functions/v2/https";

const STRIPE_API_KEY = defineString("STRIPE_API_KEY");

const db = getFirestore();

export const createUserProfile = user().onCreate(async (user) => {
  const stripeClient = new Stripe(STRIPE_API_KEY.value());

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
      currentBalance: 20,
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

export const addProfilesToExistingUsers = onCall(async () => {
  const stripeClient = new Stripe(STRIPE_API_KEY.value());

  const { users } = await getAuth().listUsers(100);
  const results: Array<Record<string, unknown>> = [];

  for (const user of users) {
    const userId = user.uid;
    const billingProfileRef = db
      .collection("users")
      .doc(userId)
      .collection("billingProfile")
      .doc("profile");
    const billingProfileDoc = await billingProfileRef.get();

    if (billingProfileDoc.exists) {
      results.push({ userId, status: "skipped" });
      continue;
    }

    try {
      const customer = await stripeClient.customers.create({
        email: user.email,
      });

      await billingProfileRef.set({
        stripeCustomerId: customer.id,
        currentBalance: 20,
        lifetimeCreditsPurchased: 0,
        welcomeCreditsGrantedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      results.push({ userId, status: "created", customerId: customer.id });
    } catch (error) {
      console.error(`Failed to create billing profile for ${userId}:`, error);
      results.push({ userId, status: "error" });
    }
  }

  return { results };
});
