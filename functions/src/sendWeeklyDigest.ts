import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
import { defineString } from "firebase-functions/params";
import {
  categorizeApplications,
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

export const sendWeeklyDigest = onSchedule("0 9 * * 1", async () => {
  if (!RESEND_API_KEY.value()) {
    console.warn("RESEND_API_KEY is not set. Skipping weekly digest.");
    return;
  }

  const resend = new Resend(RESEND_API_KEY.value());
  const now = new Date();

  const activeAppsSnapshot = await db
    .collection("jobApplications")
    .where("status", "not-in", ["rejected", "archived"])
    .get();

  if (activeAppsSnapshot.empty) {
    console.log("No active applications found. Skipping digest.");
    return;
  }

  const appsByUser = new Map<string, DigestApplication[]>();
  for (const doc of activeAppsSnapshot.docs) {
    const data = doc.data();
    const userId = data.userId as string;
    const apps = appsByUser.get(userId) || [];
    apps.push({
      id: doc.id,
      companyName: data.companyName,
      position: data.position,
      status: data.status,
      updatedAt: data.updatedAt?.toDate() || data.createdAt?.toDate() || now,
      createdAt: data.createdAt?.toDate() || now,
      appliedAt: toDateOrUndefined(data.appliedAt),
      interviewedAt: toDateOrUndefined(data.interviewedAt),
      offeredAt: toDateOrUndefined(data.offeredAt),
    });
    appsByUser.set(userId, apps);
  }

  for (const [userId, applications] of appsByUser) {
    try {
      const interviewsSnapshot = await db
        .collection("interviews")
        .where("userId", "==", userId)
        .get();

      const interviews: DigestInterview[] = interviewsSnapshot.docs.map(
        (doc) => {
          const data = doc.data();
          return {
            applicationId: data.applicationId,
            conductedAt: data.conductedAt?.toDate() || now,
            status: data.status,
          };
        },
      );

      const digest = categorizeApplications(applications, interviews, now);
      if (digest.isEmpty) continue;

      const userRecord = await getAuth().getUser(userId);
      if (!userRecord.email) {
        console.warn(`User ${userId} has no email. Skipping.`);
        continue;
      }

      const html = buildDigestEmailHtml(digest, APP_URL);
      const text = buildDigestEmailText(digest, APP_URL);

      await resend.emails.send({
        to: userRecord.email,
        from: FROM_EMAIL,
        replyTo: REPLY_TO,
        subject: "Your Weekly Job Search Update",
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${APP_URL}/../settings>`,
        },
      });

      console.log(`Digest sent to user ${userId}`);
    } catch (error) {
      console.error(`Error processing digest for user ${userId}:`, error);
    }
  }
});
