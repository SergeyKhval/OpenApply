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
    // A job saved from the landing page match tool or the browser extension
    // becomes a tracked application, with no extra steps
    if (hasPendingToolApplication()) {
      return consumePendingToolApplication(addJobApplication).then((created) => {
        if (created) {
          // The extension's job gets the same "Saved. Have you applied?" prompt
          // as a manual save; the tool's has its own on the match card
          const query = created.source === "extension" ? "created=1" : "from=tool";
          router.push(`/dashboard/applications/${created.id}?${query}`);
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
