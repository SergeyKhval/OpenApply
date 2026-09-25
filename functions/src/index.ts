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
export * from "./createBillingPortalSession";
export * from "./proAvailability";
export * from "./migrateJobDescriptions";
export * from "./jobApplications";
export * from "./sendWelcomeEmail";
export * from "./matchResumeWithJobApplication";
export * from "./matchResumeTool";
export * from "./sendWeeklyDigest";
export * from "./processUserDigest";
export * from "./signInCode";
export * from "./emailPreferences";
export * from "./deleteAccount";
export * from "./jobSignals";
export * from "./backfillJobSignals";
export * from "./jobListingRecheck";
export * from "./jobReports";
