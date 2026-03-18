import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
import { defineString } from "firebase-functions/params";
import {
  categorizeApplications,
  computeDigestStats,
  getGreetingTier,
  buildSummaryLine,
  prioritizeActions,
  DigestApplication,
  DigestInterview,
} from "./lib/digest";
import {
  buildDigestEmailHtml,
  buildDigestEmailText,
} from "./lib/digestEmail";

const RESEND_API_KEY = defineString("RESEND_API_KEY");
const db = getFirestore();

const APP_URL = "https://openapply.app/app/dashboard/applications";
const FROM_EMAIL = "Sergey <sergey@openapply.app>";
const REPLY_TO = "sergey@openapply.app";

// Status-specific dates (appliedAt, interviewedAt, offeredAt) are stored as
// JS Date objects from the SPA, but Firestore may wrap them as Timestamps.
function toDateOrUndefined(
  value: { toDate?: () => Date } | Date | undefined,
): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function")
    return value.toDate();
  return undefined;
}

export const processUserDigest = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 3 },
    rateLimits: { maxConcurrentDispatches: 10, maxDispatchesPerSecond: 5 },
  },
  async (request) => {
    const { userId } = request.data as { userId: string };
    const now = new Date();
    const resend = new Resend(RESEND_API_KEY.value());

    const appsSnapshot = await db
      .collection("jobApplications")
      .where("userId", "==", userId)
      .where("status", "not-in", ["rejected", "archived"])
      .get();

    if (appsSnapshot.empty) {
      console.log(`No active applications for user ${userId}. Skipping.`);
      return;
    }

    const applications: DigestApplication[] = appsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        companyName: data.companyName,
        position: data.position,
        status: data.status,
        updatedAt: data.updatedAt?.toDate() || data.createdAt?.toDate() || now,
        createdAt: data.createdAt?.toDate() || now,
        appliedAt: toDateOrUndefined(data.appliedAt),
        interviewedAt: toDateOrUndefined(data.interviewedAt),
        offeredAt: toDateOrUndefined(data.offeredAt),
      };
    });

    const interviewsSnapshot = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .get();

    const interviews: DigestInterview[] = interviewsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        applicationId: data.applicationId,
        conductedAt: data.conductedAt?.toDate() || now,
        status: data.status,
      };
    });

    const digest = categorizeApplications(applications, interviews, now);
    if (digest.isEmpty) {
      console.log(`Digest empty for user ${userId}. Skipping email.`);
      return;
    }

    const userRecord = await getAuth().getUser(userId);
    if (!userRecord.email) {
      console.warn(`User ${userId} has no email. Skipping.`);
      return;
    }

    const stats = computeDigestStats(digest.wins);
    const tier = getGreetingTier(digest.wins);
    const summaryLine = buildSummaryLine(stats, tier);
    const cappedActions = prioritizeActions(digest.actions, 3);

    const emailData = {
      greeting: tier,
      summaryLine,
      stats,
      actions: cappedActions,
      totalActionCount: digest.actions.length,
      appUrl: APP_URL,
    };

    const html = buildDigestEmailHtml(emailData);
    const text = buildDigestEmailText(emailData);

    await resend.emails.send({
      to: userRecord.email,
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      subject: "Your Weekly Job Search Update",
      html,
      text,
      // TODO: implement Resend-managed unsubscribes via Audiences API
    });

    console.log(`Digest sent to user ${userId}`);
  },
);
