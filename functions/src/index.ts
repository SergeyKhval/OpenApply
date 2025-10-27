import { setGlobalOptions } from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";

setGlobalOptions({ maxInstances: 10 });

if (!getApps().length) {
  initializeApp();
}

export * from "./parseResume";
export * from "./jobs";
export * from "./scrapeJobLink";
export * from "./parseJobPageWithAi";
export * from "./generateCoverLetter";
export * from "./createUserProfile";
export * from "./createStripeCheckoutSession";
export * from "./stripeWebhook";
export * from "./migrateCoverLettersToJobApplications";
export * from "./jobApplications";
export * from "./sendWelcomeEmail";
