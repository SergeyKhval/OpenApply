import { getLocalTimeZone, today } from "@internationalized/date";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { JobStatus } from "@/types";
import { trackEvent } from "@/analytics";
import { type OpenStage, statusForStage } from "@/lib/stages";

// A week after applying is when a follow-up usually makes sense
export const FOLLOW_UP_AFTER_APPLYING_DAYS = 7;
export const SNOOZE_FOLLOW_UP_DAYS = 3;

function startOfToday() {
  const timezone = getLocalTimeZone();
  return today(timezone).toDate(timezone);
}

function daysFromToday(days: number) {
  const date = startOfToday();
  date.setDate(date.getDate() + days);
  return date;
}

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
    else if (status === "draft")
      Object.assign(updates, {
        appliedAt: null,
        interviewedAt: null,
        offeredAt: null,
        hiredAt: null,
        archivedAt: null,
      });

    trackEvent("status_changed", { applicationId, status });
    return updateDoc(doc(db, "jobApplications", applicationId), updates);
  }

  // The one path every stage change goes through: stage menu, stepper, and board drag-and-drop.
  // Saved -> Applied is "I applied": it also sets the follow-up date.
  function moveToStage(job: { id: string; status: JobStatus }, stage: OpenStage) {
    if (stage === "applied" && job.status === "draft") return markApplied(job.id);
    return updateJobApplicationStatus(job.id, statusForStage(stage));
  }

  // "I applied": Applied today, follow up in a week
  function markApplied(applicationId: string) {
    trackEvent("status_changed", { applicationId, status: "applied" });
    return updateDoc(doc(db, "jobApplications", applicationId), {
      status: "applied",
      appliedAt: startOfToday(),
      followUpAt: daysFromToday(FOLLOW_UP_AFTER_APPLYING_DAYS),
      interviewedAt: null,
      offeredAt: null,
      hiredAt: null,
      updatedAt: serverTimestamp(),
    });
  }

  function scheduleFollowUp(applicationId: string, days = FOLLOW_UP_AFTER_APPLYING_DAYS) {
    return updateDoc(doc(db, "jobApplications", applicationId), {
      followUpAt: daysFromToday(days),
      updatedAt: serverTimestamp(),
    });
  }

  function snoozeFollowUp(applicationId: string) {
    return updateDoc(doc(db, "jobApplications", applicationId), {
      followUpAt: daysFromToday(SNOOZE_FOLLOW_UP_DAYS),
      updatedAt: serverTimestamp(),
    });
  }

  function clearFollowUp(applicationId: string) {
    return updateDoc(doc(db, "jobApplications", applicationId), {
      followUpAt: null,
      updatedAt: serverTimestamp(),
    });
  }

  return { updateJobApplicationStatus, moveToStage, markApplied, scheduleFollowUp, snoozeFollowUp, clearFollowUp };
}
