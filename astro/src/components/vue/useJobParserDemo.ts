import { ref, onUnmounted } from "vue";
import {
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseFunctions,
} from "../../lib/firebase";

export type JobIngestionStatus =
  | "pending"
  | "scrapped"
  | "parsing"
  | "parsed"
  | "parse-failed"
  | "failed";

export type JobParserState =
  | "idle"
  | "initializing"
  | "fetching"
  | "waiting"
  | "ready"
  | "error";

export type ParsedJobData = {
  companyName?: string;
  position?: string;
  remotePolicy?: string;
  employmentType?: string;
  technologies?: string[];
  companyLogoUrl?: string;
  description?: string;
};

const TIMEOUT_MS = 60_000;

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName, properties);
  }
}

export function useJobParserDemo() {
  const state = ref<JobParserState>("idle");
  const parsedData = ref<ParsedJobData | null>(null);
  const errorMessage = ref<string | null>(null);

  let unsubscribe: (() => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function cleanup() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  async function start(url: string) {
    cleanup();
    state.value = "initializing";
    parsedData.value = null;
    errorMessage.value = null;

    trackEvent("landing_job_parse_started", { url });

    try {
      await getFirebaseAuth();

      state.value = "fetching";

      const fns = await getFirebaseFunctions();
      const { httpsCallable } = await import("firebase/functions");
      const callable = httpsCallable<{ url: string }, { id: string }>(
        fns,
        "jobs",
      );
      const result = await callable({ url });
      const jobId = result.data.id;

      if (!jobId) {
        state.value = "error";
        errorMessage.value = "Unable to start job parsing.";
        trackEvent("landing_job_parse_failed", {
          url,
          error: "no_job_id",
        });
        return;
      }

      state.value = "waiting";

      const db = await getFirebaseFirestore();
      const { doc, onSnapshot } = await import("firebase/firestore");
      const docRef = doc(db, "jobs", jobId);

      timeoutId = setTimeout(() => {
        cleanup();
        state.value = "error";
        errorMessage.value =
          "Parsing is taking longer than expected. Please try again.";
        trackEvent("landing_job_parse_failed", {
          url,
          error: "timeout",
        });
      }, TIMEOUT_MS);

      unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          const data = snapshot.data() as
            | { status: JobIngestionStatus; parsedData?: ParsedJobData; errorMessage?: string }
            | undefined;

          if (!data) return;

          if (data.status === "parsed" && data.parsedData) {
            cleanup();
            parsedData.value = data.parsedData;
            state.value = "ready";
            trackEvent("landing_job_parsed", {
              url,
              company: data.parsedData.companyName,
              position: data.parsedData.position,
            });
          } else if (
            data.status === "parse-failed" ||
            data.status === "failed"
          ) {
            cleanup();
            state.value = "error";
            errorMessage.value =
              data.errorMessage || "Failed to parse the job listing.";
            trackEvent("landing_job_parse_failed", {
              url,
              error: data.status,
              message: data.errorMessage,
            });
          }
        },
        (err) => {
          cleanup();
          state.value = "error";
          errorMessage.value = "Connection error. Please try again.";
          trackEvent("landing_job_parse_failed", {
            url,
            error: "snapshot_error",
            message: err.message,
          });
        },
      );
    } catch (err) {
      cleanup();
      state.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "Something went wrong.";
      trackEvent("landing_job_parse_failed", {
        url,
        error: "exception",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function reset() {
    cleanup();
    state.value = "idle";
    parsedData.value = null;
    errorMessage.value = null;
  }

  onUnmounted(cleanup);

  return {
    state,
    parsedData,
    errorMessage,
    start,
    reset,
  };
}
