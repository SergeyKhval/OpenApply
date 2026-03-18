import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";

const db = getFirestore();

export const sendWeeklyDigest = onSchedule("0 9 * * 1", async () => {
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
