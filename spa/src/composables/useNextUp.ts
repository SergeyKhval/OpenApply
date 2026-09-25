import { computed } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, limit, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { buildNextUp, type NextUpInterview } from "@/lib/nextUp";

type InterviewDoc = Omit<NextUpInterview, "conductedAt"> & { conductedAt: Timestamp };

// Follow-ups due, interviews this week and stale saved jobs for the Jobs page
export function useNextUp() {
  const user = useCurrentUser();
  const { jobApplications } = useJobApplicationsData();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Needs the (userId, conductedAt) index in firestore.indexes.json
  const interviewsQuery = computed(() =>
    user.value
      ? query(
          collection(db, "interviews"),
          where("userId", "==", user.value.uid),
          where("conductedAt", ">=", startOfToday),
          orderBy("conductedAt", "asc"),
          limit(20),
        )
      : null,
  );
  const { data: interviews } = useCollection<InterviewDoc>(interviewsQuery);

  const items = computed(() =>
    buildNextUp(
      jobApplications.value ?? [],
      (interviews.value ?? []).map((interview) => ({
        ...interview,
        conductedAt: interview.conductedAt.toDate(),
      })),
      new Date(),
    ),
  );

  return { items };
}
