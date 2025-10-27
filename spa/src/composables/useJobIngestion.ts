import { computed, ref } from "vue";
import { collection, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useDocument } from "vuefire";
import { db, functions } from "@/firebase/config.ts";

export type JobIngestionStatus =
  | "pending"
  | "scrapped"
  | "parsing"
  | "parsed"
  | "parse-failed"
  | "failed";

export type JobIngestionState =
  | "idle"
  | "fetching"
  | "waiting"
  | "ready"
  | "error";

export type JobSnapshot = {
  id?: string;
  status: JobIngestionStatus;
  jobDescriptionLink?: string;
  parsedData?: {
    companyName?: string | null;
    position?: string | null;
    remotePolicy?: string | null;
    employmentType?: string | null;
    technologies?: string[];
    companyLogoUrl?: string | null;
  } | null;
  errorMessage?: string | null;
  [key: string]: unknown;
};

const PROCESSING_STATUSES: JobIngestionStatus[] = [
  "pending",
  "scrapped",
  "parsing",
];

const COMPLETED_STATUSES: JobIngestionStatus[] = [
  "parsed",
  "parse-failed",
  "failed",
];

export const useJobIngestion = () => {
  const callable = httpsCallable<{ url: string }, { id: string }>(
    functions,
    "jobs",
  );

  const requestError = ref<string | null>(null);
  const jobId = ref<string | null>(null);
  const data = ref<{ id: string } | undefined>(undefined);
  const error = ref<unknown | undefined>(undefined);
  const isFetching = ref(false);

  const documentRef = computed(() =>
    jobId.value ? doc(collection(db, "jobs"), jobId.value) : null,
  );

  const latestSnapshot = useDocument<JobSnapshot>(documentRef);

  const errorMessage = computed(() =>
    requestError.value ?? latestSnapshot.value?.errorMessage ?? null,
  );

  const status = computed<JobIngestionState>(() => {
    if (requestError.value) {
      return "error";
    }

    if (isFetching.value) {
      return "fetching";
    }

    if (!jobId.value) {
      return "idle";
    }

    const snapshot = latestSnapshot.value;

    if (!snapshot) {
      return "waiting";
    }

    if (COMPLETED_STATUSES.includes(snapshot.status)) {
      return "ready";
    }

    if (PROCESSING_STATUSES.includes(snapshot.status)) {
      return "waiting";
    }

    return "waiting";
  });

  const execute = async (url: string) => {
    isFetching.value = true;
    error.value = undefined;

    try {
      const result = await callable({ url });
      data.value = result.data;
      return result.data;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      isFetching.value = false;
    }
  };

  const start = async (url: string) => {
    requestError.value = null;
    jobId.value = null;
    latestSnapshot.value = undefined;
    data.value = undefined;

    try {
      await execute(url);
    } catch (err) {
      requestError.value =
        err instanceof Error ? err.message : String(err ?? "Unknown error");
      return;
    }

    if (error.value) {
      const errValue = error.value;
      requestError.value =
        errValue instanceof Error
          ? errValue.message
          : typeof errValue === "string"
          ? errValue
          : "Unable to start job ingestion.";
      return;
    }
    // @ts-expect-error id is present on data here
    const id = data.value?.id;

    if (!id) {
      requestError.value = "Unable to start job ingestion.";
      return;
    }

    jobId.value = id;
  };

  const reset = () => {
    requestError.value = null;
    jobId.value = null;
    data.value = undefined;
    latestSnapshot.value = undefined;
  };

  return {
    start,
    reset,
    status,
    errorMessage,
    latestSnapshot,
  };
};
