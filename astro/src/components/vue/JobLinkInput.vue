<template>
  <div class="w-full max-w-xl mx-auto">
    <form @submit.prevent="handleSubmit" class="flex flex-col gap-2 sm:flex-row">
      <input
        v-model="jobUrl"
        type="url"
        required
        aria-label="Job posting link"
        autocomplete="off"
        inputmode="url"
        placeholder="https://jobs.example.com/senior-engineer..."
        class="h-12 w-full min-w-0 shrink-0 sm:flex-1 rounded-full border border-input bg-card px-5 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :disabled="isSubmitting"
      />
      <button
        type="submit"
        :disabled="isSubmitting"
        class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-semibold h-12 shrink-0 rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        {{ isSubmitting ? "Parsing…" : "Track this job" }}
      </button>
    </form>

    <p v-if="errorMessage" role="alert" class="text-destructive text-sm mt-2 text-center">
      {{ errorMessage }}
    </p>

    <p class="text-sm text-muted-foreground mt-3 text-center">
      or
      <a :href="`${spaBase}/?mode=signup`" class="text-primary hover:underline">skip and sign up directly</a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { submitJobLink } from "../../lib/submitJobLink";

const jobUrl = ref("");
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);

const spaBase = import.meta.env.PUBLIC_SPA_BASE_URL || "/app";

function trackEvent(eventName: string) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName);
  }
}

async function handleSubmit() {
  isSubmitting.value = true;
  errorMessage.value = null;

  trackEvent("lp_job_parse_started");

  const result = await submitJobLink(jobUrl.value);
  if (!result.ok) {
    errorMessage.value = result.errorMessage;
    isSubmitting.value = false;
    return;
  }

  if (result.signedIn) trackEvent("lp_auth_skipped");
  window.location.href = result.redirectUrl;
}
</script>
