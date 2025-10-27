import { computed } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { JobApplication } from "@/types";

export function useJobApplicationsData() {
  const user = useCurrentUser();

  const jobApplicationsQuery = computed(() =>
    user.value
      ? query(
          collection(db, "jobApplications"),
          where("userId", "==", user.value.uid),
          orderBy("createdAt", "desc")
        )
      : null
  );

  const { data: jobApplications, pending: isLoading } = useCollection<JobApplication>(
    jobApplicationsQuery
  );

  return {
    jobApplications,
    isLoading,
  };
}