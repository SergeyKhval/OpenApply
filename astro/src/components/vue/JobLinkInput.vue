<template>
  <div class="w-full max-w-xl mx-auto">
    <form @submit.prevent="handleSubmit" class="flex gap-2">
      <input
        v-model="jobUrl"
        type="url"
        required
        placeholder="https://jobs.example.com/senior-engineer..."
        class="flex-1 h-11 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :disabled="isSubmitting"
      />
      <button
        type="submit"
        :disabled="isSubmitting"
        class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-11 rounded-md px-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-primary/40"
      >
        {{ isSubmitting ? "Parsing..." : "Parse Job" }}
      </button>
    </form>

    <p v-if="errorMessage" class="text-destructive text-sm mt-2 text-center">
      {{ errorMessage }}
    </p>

    <p class="text-sm text-muted-foreground mt-3 text-center">
      or
      <a :href="`${spaBase}/`" class="text-primary hover:underline">skip and sign up directly</a>
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
