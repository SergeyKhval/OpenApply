import { JobApplication } from "@/types";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";

export function restoreJobApplication(application: JobApplication) {
  if (!application) return;

  const updates = {
    updatedAt: serverTimestamp(),
  };

  // restore application to the most recent state
  if (application.hiredAt) Object.assign(updates, { status: "hired" });
  else if (application.offeredAt) Object.assign(updates, { status: "offered" });
  else if (application.interviewedAt)
    Object.assign(updates, { status: "interviewing" });
  else Object.assign(updates, { status: "applied" });

  return updateDoc(doc(db, "jobApplications", application.id), updates);
}
