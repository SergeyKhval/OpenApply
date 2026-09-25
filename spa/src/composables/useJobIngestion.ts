import { computed, ref, watch } from "vue";
import { collection, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useDocument } from "vuefire";
import { db, functions } from "@/firebase/config.ts";
import { trackEvent } from "@/analytics";

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
  // Set on jobs made from a pasted description: the text itself is `content`,
  // and the posting's link, if given, is `postingLink`
  source?: "paste";
  postingLink?: string;
  content?: string;
  parsedData?: {
    companyName?: string;
    position?: string;
    remotePolicy?: string;
    employmentType?: string;
    technologies?: string[];
    companyLogoUrl?: string;
    description?: string;
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

const JOB_ID_PATTERN = /^[a-zA-Z0-9]{10,30}$/;

// Maps a callable Cloud Function failure to plain language; never shows a
// raw Firebase code like "internal" or "deadline-exceeded" to the user.
export function friendlyRequestError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : "";

  if (code === "functions/invalid-argument" && message) {
    return message;
  }
  if (code === "functions/resource-exhausted" && message) {
    return message;
  }
  if (code === "functions/deadline-exceeded") {
    return "That took too long. Enter the details yourself instead.";
  }
  if (code === "functions/unavailable" || message.includes("network") || message.includes("fetch")) {
    return "Looks like the internet gremlins got in the way. Check your connection, or enter the details yourself.";
  }
  return "That job page wasn't cooperating. Enter the details yourself instead.";
}

export function isValidJobId(value: unknown): value is string {
  return typeof value === "string" && JOB_ID_PATTERN.test(value);
}

export function isJobParsing(snapshot: JobSnapshot | null | undefined, jobId: string | null): boolean {
  if (!jobId) return false;
  if (snapshot === undefined) return true; // loading
  if (!snapshot) return false; // doc doesn't exist
  return PROCESSING_STATUSES.includes(snapshot.status);
}

export function isPastedJob(snapshot: JobSnapshot | null | undefined): boolean {
  return snapshot?.source === "paste";
}

export function jobLinkOf(snapshot: JobSnapshot | null | undefined): string {
  return snapshot?.jobDescriptionLink || snapshot?.postingLink || "";
}

// The description to prefill: what the parser found, or for a pasted job
// whose parse failed, the paste itself
export function jobDescriptionOf(snapshot: JobSnapshot | null | undefined): string {
  if (snapshot?.parsedData?.description) return snapshot.parsedData.description;
  return isPastedJob(snapshot) && typeof snapshot?.content === "string" ? snapshot.content : "";
}

export function isJobParseFailed(snapshot: JobSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return (
    ["parse-failed", "failed"].includes(snapshot.status) ||
    (snapshot.status === "parsed" && (!snapshot.parsedData?.companyName || !snapshot.parsedData?.position))
  );
}

// A link to scrape, or a pasted description with the posting's link if known
export type JobRequest = { url: string } | { text: string; url?: string };

export const useJobIngestion = () => {
  const callable = httpsCallable<JobRequest, { id: string }>(
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

  const errorMessage = computed(
    () => requestError.value ?? latestSnapshot.value?.errorMessage ?? null,
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

  const execute = async (request: JobRequest) => {
    isFetching.value = true;
    error.value = undefined;

    try {
      const result = await callable(request);
      data.value = result.data;
      return result.data;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      isFetching.value = false;
    }
  };

  // Resolves to the new job's id, or null when the request failed
  const start = async (request: string | JobRequest): Promise<string | null> => {
    requestError.value = null;
    jobId.value = null;
    latestSnapshot.value = undefined;
    data.value = undefined;

    try {
      await execute(typeof request === "string" ? { url: request } : request);
    } catch (err) {
      requestError.value = friendlyRequestError(err);
      return null;
    }

    if (error.value) {
      requestError.value = friendlyRequestError(error.value);
      return null;
    }
    // @ts-expect-error id is present on data here
    const id = data.value?.id;

    if (!id) {
      requestError.value = "Unable to start job ingestion.";
      return null;
    }

    jobId.value = id;
    return id;
  };

  const reset = () => {
    requestError.value = null;
    jobId.value = null;
    data.value = undefined;
    latestSnapshot.value = undefined;
  };

  watch(latestSnapshot, (snapshot) => {
    if (!snapshot) return;
    if (snapshot.status === "parsed") {
      trackEvent("job_parse_succeeded", {
        company: snapshot.parsedData?.companyName,
        position: snapshot.parsedData?.position,
      });
    } else if (snapshot.status === "parse-failed" || snapshot.status === "failed") {
      trackEvent("job_parse_failed", { error: snapshot.errorMessage ?? undefined });
    }
  });

  return {
    start,
    reset,
    status,
    errorMessage,
    latestSnapshot,
  };
};
