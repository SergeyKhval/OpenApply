import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { isValidJobId } from "@/composables/useJobIngestion";

export function usePostAuthRedirect() {
  const router = useRouter();
  const route = useRoute();

  const pendingJobId = computed(() => {
    const job = route.query.job;
    return isValidJobId(job) ? job : null;
  });

  const hasPendingJob = computed(() => !!pendingJobId.value);

  const fromLp = computed(() => route.query.from === "lp");

  function redirect() {
    if (pendingJobId.value) {
      const params = new URLSearchParams({ job: pendingJobId.value });
      if (fromLp.value) params.set("from", "lp");
      router.push(`/dashboard/applications/new?${params}`);
    } else {
      router.push("/dashboard/applications");
    }
  }

  return { redirect, hasPendingJob, pendingJobId };
}
