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
import {
  getFirebaseAuth,
  getFirebaseFunctions,
} from "../../lib/firebase";

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

  try {
    // Initialize Firebase auth (anonymous sign-in)
    const auth = await getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      errorMessage.value = "Could not connect to our servers. Check your internet connection and try again.";
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
      errorMessage.value = "The server accepted the request but didn't return a tracking ID. Try again in a moment.";
      isSubmitting.value = false;
      return;
    }

    // Redirect based on auth state
    if (isAuthenticated) {
      trackEvent("lp_auth_skipped");
      window.location.href = `${spaBase}/dashboard/applications/new?job=${jobId}&from=lp`;
    } else {
      window.location.href = `${spaBase}/?job=${jobId}&from=lp`;
    }
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : "";
    if (rawMessage.includes("network") || rawMessage.includes("fetch")) {
      errorMessage.value = "Network error — check your connection and try again.";
    } else if (rawMessage.includes("INVALID_ARGUMENT") || rawMessage.includes("invalid")) {
      errorMessage.value = "That URL doesn't look like a job listing we can parse. Double-check the link and try again.";
    } else {
      errorMessage.value = "Something broke on our end. Try again in a moment — if it keeps happening, the URL might not be supported.";
    }
    isSubmitting.value = false;
  }
}
</script>
