import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getCountFromServer,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/firebase/config";
import { useCurrentUser } from "vuefire";
import type { CreateJobApplicationInput, JobStatus } from "@/types";
import { getLocalTimeZone } from "@internationalized/date";
import { trackEvent } from "@/analytics";

type ApplicationCreatedProperties = {
  method: "link_parse" | "manual";
  source?: "landing_page_parse";
};

// Activation metric: fires once, when the user's first application is saved.
async function trackIfFirstApplication(
  user: User,
  properties: ApplicationCreatedProperties,
) {
  try {
    const snapshot = await getCountFromServer(
      query(collection(db, "jobApplications"), where("userId", "==", user.uid)),
    );
    if (snapshot.data().count !== 1) return;

    const signedUpAt = Date.parse(user.metadata?.creationTime ?? "");
    trackEvent("first_job_application_created", {
      ...properties,
      minutesSinceSignup: Number.isFinite(signedUpAt)
        ? Math.round((Date.now() - signedUpAt) / 60_000)
        : undefined,
    });
  } catch (err) {
    console.error("Error tracking first job application:", err);
  }
}

export function useJobApplications() {
  const user = useCurrentUser();

  const addJobApplication = async (
    payload: CreateJobApplicationInput,
    options?: { source?: "landing_page_parse" },
  ): Promise<{ success: boolean; error?: string; id?: string }> => {
    if (!user.value) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const docRef = await addDoc(collection(db, "jobApplications"), {
        ...payload,
        status: "draft" as JobStatus,
        userId: user.value.uid,
        createdAt: serverTimestamp(),
      });

      const method = payload.jobDescriptionLink ? "link_parse" : "manual";
      trackEvent("job_application_created", {
        method,
        company: payload.companyName,
        position: payload.position,
        source: options?.source,
      });
      void trackIfFirstApplication(user.value, { method, source: options?.source });
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error("Error adding job application:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  const updateJobApplication = async (
    applicationId: string,
    data: Partial<CreateJobApplicationInput & { status: JobStatus }>,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user.value) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const docRef = doc(db, "jobApplications", applicationId);
      const timezone = getLocalTimeZone();

      const sanitizedData: Record<string, unknown> = { ...data };
      const dateFields = [
        "appliedAt",
        "interviewedAt",
        "offeredAt",
        "hiredAt",
      ] as const;

      for (const field of dateFields) {
        const value = data[field];

        if (value && typeof value === "object" && "toDate" in value) {
          sanitizedData[field] = value.toDate(timezone);
        }
      }

      await updateDoc(docRef, {
        ...sanitizedData,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      console.error("Error updating job application:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  const deleteJobApplication = async (
    applicationId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user.value) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const docRef = doc(db, "jobApplications", applicationId);
      await deleteDoc(docRef);

      return { success: true };
    } catch (err) {
      console.error("Error deleting job application:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  return {
    addJobApplication,
    updateJobApplication,
    deleteJobApplication,
  };
}
