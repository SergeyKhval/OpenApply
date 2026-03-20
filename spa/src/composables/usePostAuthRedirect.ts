import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";

export function usePostAuthRedirect() {
  const router = useRouter();
  const route = useRoute();

  const pendingJobId = computed(() => {
    const job = route.query.job;
    return typeof job === "string" ? job : null;
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
