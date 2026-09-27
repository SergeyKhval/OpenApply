import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useDocument } from "vuefire";
import { doc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { signLines, type JobSignalsDoc } from "@/lib/jobSignals";
import type { JobApplication } from "@/types";

/** The posting signals to show for a saved job, from its public jobSignals doc. */
export function useJobSignals(
  job: MaybeRefOrGetter<Pick<JobApplication, "jobKeyHash" | "companyName"> | null | undefined>,
  now: MaybeRefOrGetter<Date>,
) {
  const source = computed(() => {
    const hash = toValue(job)?.jobKeyHash;
    return hash ? doc(db, "jobSignals", hash) : null;
  });
  const { data } = useDocument<JobSignalsDoc>(source);
  return computed(() => signLines(data.value, toValue(job)?.companyName ?? "", toValue(now)));
}
