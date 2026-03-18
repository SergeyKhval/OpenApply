import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import { defineString } from "firebase-functions/params";

const RESEND_API_KEY = defineString("RESEND_API_KEY");
const db = getFirestore();

export const sendWeeklyDigest = onSchedule("0 9 * * 1", async () => {
  // Gate: self-hosted instances without email configured skip the digest entirely
  if (!RESEND_API_KEY.value()) {
    console.log("RESEND_API_KEY not configured. Skipping weekly digest.");
    return;
  }

  const activeAppsSnapshot = await db
    .collection("jobApplications")
    .where("status", "not-in", ["rejected", "archived"])
    .select("userId")
    .get();

  if (activeAppsSnapshot.empty) {
    console.log("No active applications found. Skipping digest.");
    return;
  }

  const userIds = new Set<string>();
  for (const doc of activeAppsSnapshot.docs) {
    userIds.add(doc.data().userId);
  }

  const queue = getFunctions().taskQueue("processUserDigest");
  const enqueuePromises = [...userIds].map((userId) =>
    queue.enqueue({ userId }),
  );
  await Promise.all(enqueuePromises);

  console.log(`Enqueued digest tasks for ${userIds.size} users.`);
});
