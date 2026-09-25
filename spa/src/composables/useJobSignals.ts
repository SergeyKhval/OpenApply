import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useDocument } from "vuefire";
import { doc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { signLines, type JobSignalsDoc } from "@/lib/jobSignals";
import type { JobApplication } from "@/types";

/**
 * The posting signals to show for a saved job, or none while the job-signals
 * flag is off. Reads the public jobSignals doc only when the flag is on.
 */
export function useJobSignals(
  job: MaybeRefOrGetter<Pick<JobApplication, "jobKeyHash" | "companyName"> | null | undefined>,
  now: MaybeRefOrGetter<Date>,
) {
  const enabled = useFeatureFlag("job-signals");
  const source = computed(() => {
    const hash = toValue(job)?.jobKeyHash;
    return enabled.value && hash ? doc(db, "jobSignals", hash) : null;
  });
  const { data } = useDocument<JobSignalsDoc>(source);
  return computed(() =>
    enabled.value ? signLines(data.value, toValue(job)?.companyName ?? "", toValue(now)) : [],
  );
}
