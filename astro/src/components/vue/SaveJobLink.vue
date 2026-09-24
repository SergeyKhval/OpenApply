<template>
  <div class="w-full max-w-md mx-auto text-center flex flex-col items-center gap-4">
    <template v-if="!errorMessage">
      <div
        class="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
        aria-hidden="true"
      />
      <h1 class="text-2xl font-bold text-foreground">Saving this job to OpenApply...</h1>
      <p v-if="jobHost" class="text-sm text-muted-foreground">{{ jobHost }}</p>
    </template>
    <template v-else>
      <h1 class="text-2xl font-bold text-foreground">We couldn't save that job</h1>
      <p role="alert" class="text-muted-foreground">{{ errorMessage }}</p>
      <div class="flex flex-col sm:flex-row gap-2">
        <button
          v-if="jobUrl"
          type="button"
          class="inline-flex items-center justify-center h-11 rounded-md px-6 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          @click="save"
        >
          Try again
        </button>
        <a
          :href="`${spaBase}/`"
          class="inline-flex items-center justify-center h-11 rounded-md px-6 text-sm font-medium border border-border hover:bg-muted"
        >
          Open OpenApply
        </a>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { submitJobLink } from "../../lib/submitJobLink";
import { savePendingToolApplication } from "../../lib/pendingToolApplication";
import { decodeExtensionJob, EXTENSION_JOB_PARAM, type ExtensionJob } from "../../../../shared/extensionJob";

const spaBase = import.meta.env.PUBLIC_SPA_BASE_URL || "/app";

const jobUrl = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

const jobHost = computed(() => {
  if (!jobUrl.value) return "";
  try {
    return new URL(jobUrl.value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
});

function trackEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName, properties);
  }
}

// Only real web pages; anything else would just fail to parse later
function readJobUrl(search: string): string | null {
  const raw = new URLSearchParams(search).get("url");
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

async function save() {
  if (!jobUrl.value) {
    errorMessage.value = "There's no job link here. Open a job posting and click Save in the extension.";
    return;
  }
  errorMessage.value = null;
  trackEvent("extension_save_started", { job_host: jobHost.value });

  const result = await submitJobLink(jobUrl.value);
  if (!result.ok) {
    errorMessage.value = result.errorMessage;
    trackEvent("extension_save_failed", { job_host: jobHost.value });
    return;
  }
  // Replace, so Back from the app doesn't land here and save again
  window.location.replace(result.redirectUrl);
}

// The extension read the job from the page: hand it to the app as a pending
// application, with no server scrape. The app creates it at once for a
// signed-in user, or right after signup.
function saveFromExtension(job: ExtensionJob): boolean {
  jobUrl.value = job.url;
  const saved = savePendingToolApplication({
    source: "extension",
    companyName: job.company,
    position: job.title,
    location: job.location,
    jobDescription: job.description,
    jobDescriptionLink: job.url,
    technologies: [],
  });
  if (!saved) return false;
  trackEvent("extension_save_started", { job_host: jobHost.value, mode: "extracted" });

  const params = new URLSearchParams({ from: "extension" });
  new URLSearchParams(window.location.search).forEach((value, key) => {
    if (key.startsWith("utm_")) params.set(key, value);
  });
  // Replace, so Back from the app doesn't land here and save again
  window.location.replace(`${spaBase}/?${params}`);
  return true;
}

onMounted(async () => {
  const { hash } = window.location;
  const fromExtension = new URLSearchParams(hash.slice(1)).has(EXTENSION_JOB_PARAM);
  const extensionJob = fromExtension ? await decodeExtensionJob(hash) : null;
  if (fromExtension) {
    // The job is in memory now; keep it out of history and bookmarks
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
  }
  if (extensionJob && saveFromExtension(extensionJob)) return;

  // Storage blocked: the link still works through the server parser
  jobUrl.value = extensionJob?.url ?? readJobUrl(window.location.search);
  if (fromExtension && !jobUrl.value) {
    errorMessage.value = "We couldn't read the job the extension sent. Open the posting and click Save again.";
    trackEvent("extension_save_failed", { reason: "bad_payload" });
    return;
  }
  save();
});
</script>
