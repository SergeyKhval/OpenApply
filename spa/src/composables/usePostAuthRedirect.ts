import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { isValidJobId } from "@/composables/useJobIngestion";
import { useJobApplications } from "@/composables/useJobApplications";
import {
  consumePendingToolApplication,
  hasPendingToolApplication,
} from "@/composables/pendingToolApplication";

export function usePostAuthRedirect() {
  const router = useRouter();
  const route = useRoute();
  const { addJobApplication } = useJobApplications();

  const pendingJobId = computed(() => {
    const job = route.query.job;
    return isValidJobId(job) ? job : null;
  });

  const hasPendingJob = computed(() => !!pendingJobId.value);

  const fromLp = computed(() => route.query.from === "lp");

  function redirect() {
    // A job saved from the landing page match tool becomes the user's first
    // tracked application, with no extra steps
    if (hasPendingToolApplication()) {
      return consumePendingToolApplication(addJobApplication).then((applicationId) => {
        if (applicationId) {
          router.push(`/dashboard/applications/${applicationId}?from=tool`);
        } else {
          redirectToDefault();
        }
      });
    }
    redirectToDefault();
  }

  function redirectToDefault() {
    const redirectPath = route.query.redirect;
    if (typeof redirectPath === "string" && redirectPath.startsWith("/")) {
      router.push(redirectPath);
    } else if (pendingJobId.value) {
      const params = new URLSearchParams({ job: pendingJobId.value });
      if (fromLp.value) params.set("from", "lp");
      router.push(`/dashboard/applications/new?${params}`);
    } else {
      router.push("/dashboard/applications");
    }
  }

  return { redirect, hasPendingJob, pendingJobId };
}
