import { computed } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { Contact, JobApplication } from "@/types";
import { groupContactsByPerson } from "@/lib/people";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";

// Every contact across every job, grouped by person. Reuses the same
// `contacts` collection the per-job timeline reads (see useJobTimeline);
// no new data model.
export function usePeople() {
  const user = useCurrentUser();

  const contactsQuery = computed(() =>
    user.value
      ? query(collection(db, "contacts"), where("userId", "==", user.value.uid), orderBy("createdAt", "desc"))
      : null,
  );
  const { data: contacts, pending: contactsPending } = useCollection<Contact>(contactsQuery);
  const { jobApplications, isLoading: jobsPending } = useJobApplicationsData();

  const jobsById = computed(() =>
    Object.fromEntries((jobApplications.value ?? []).map((job) => [job.id, job])) as Record<
      string,
      Pick<JobApplication, "id" | "companyName" | "position"> | undefined
    >,
  );

  const people = computed(() => groupContactsByPerson(contacts.value ?? [], jobsById.value));
  const isLoading = computed(() => contactsPending.value || jobsPending.value);

  return { people, isLoading };
}
