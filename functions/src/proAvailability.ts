import { onCall } from "firebase-functions/v2/https";
import { isProOnSale } from "./lib/proPrice";

// Lets the app and the landing show Pro as "coming soon" until the Stripe
// price is configured, then switch to the buy button with no client deploy.
// Public: it says nothing about any account.
export const getProAvailability = onCall(() => ({ proAvailable: isProOnSale() }));
