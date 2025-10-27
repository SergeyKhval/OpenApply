import { getLocalTimeZone, today } from "@internationalized/date";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { JobStatus } from "@/types";

export function useUpdateJobApplicationStatus() {
  function updateJobApplicationStatus(
    applicationId: string,
    status: JobStatus,
  ) {
    const timezone = getLocalTimeZone();
    const currentDate = today(timezone).toDate(timezone);
    const updates = { status, updatedAt: serverTimestamp() };

    if (status === "hired") Object.assign(updates, { hiredAt: currentDate });
    else if (status === "offered")
      Object.assign(updates, { offeredAt: currentDate, hiredAt: null });
    else if (status === "interviewing")
      Object.assign(updates, {
        interviewedAt: currentDate,
        offeredAt: null,
        hiredAt: null,
      });
    else if (status === "applied")
      Object.assign(updates, {
        interviewedAt: null,
        offeredAt: null,
        hiredAt: null,
      });
    else if (status === "archived")
      Object.assign(updates, { archivedAt: serverTimestamp() });

    return updateDoc(doc(db, "jobApplications", applicationId), updates);
  }

  return { updateJobApplicationStatus };
}
