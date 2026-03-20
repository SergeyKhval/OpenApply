<template>
  <div class="w-full max-w-xl mx-auto">
    <form @submit.prevent="handleSubmit" class="flex gap-2">
      <input
        v-model="jobUrl"
        type="url"
        required
        placeholder="https://linkedin.com/jobs/..."
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
      <a href="/app/" class="text-primary hover:underline">skip and sign up directly</a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  getFirebaseAuth,
  getFirebaseFunctions,
} from "../../lib/firebase";

const jobUrl = ref("");
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);

function trackEvent(eventName: string) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName);
  }
}

async function handleSubmit() {
  isSubmitting.value = true;
  errorMessage.value = null;

  trackEvent("lp_job_parse_started");

  try {
    // Initialize Firebase auth (anonymous sign-in)
    const auth = await getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      errorMessage.value = "Unable to initialize. Please try again.";
      isSubmitting.value = false;
      return;
    }

    // Check if user is already authenticated (non-anonymous)
    const isAuthenticated = !currentUser.isAnonymous;

    // Call the jobs Cloud Function
    const fns = await getFirebaseFunctions();
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<{ url: string }, { id: string }>(fns, "jobs");
    const result = await callable({ url: jobUrl.value });
    const jobId = result.data.id;

    if (!jobId) {
      errorMessage.value = "Unable to start parsing. Please try again.";
      isSubmitting.value = false;
      return;
    }

    // Redirect based on auth state
    if (isAuthenticated) {
      trackEvent("lp_auth_skipped");
      window.location.href = `/app/dashboard/applications/new?job=${jobId}&from=lp`;
    } else {
      window.location.href = `/app/?job=${jobId}&from=lp`;
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    isSubmitting.value = false;
  }
}
</script>
