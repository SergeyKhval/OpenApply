<template>
  <div class="w-full">
    <form @submit.prevent="handleSubmit" class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <!-- Fixed height on the wrapper, not the input: in a column a flex input can collapse to a strip -->
      <div
        class="flex h-[54px] w-full shrink-0 items-center gap-2.5 rounded-field border border-input bg-card px-4 sm:h-[52px] sm:w-auto sm:flex-1 sm:rounded-full focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
      >
        <i class="ph ph-link text-lg text-muted-foreground" aria-hidden="true"></i>
        <input
          :id="inputId"
          v-model="jobUrl"
          type="url"
          required
          aria-label="Job posting link"
          autocomplete="off"
          inputmode="url"
          :placeholder="placeholder"
          class="h-full w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          :disabled="isSubmitting"
        />
      </div>
      <button
        type="submit"
        :disabled="isSubmitting"
        :class="[
          'inline-flex h-[52px] w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-[26px] text-[16.5px] font-semibold disabled:pointer-events-none disabled:opacity-50 sm:w-auto',
          'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          secondaryOnChromium &&
            'chromium:border-input chromium:bg-card chromium:text-foreground chromium:hover:bg-muted',
        ]"
      >
        {{ isSubmitting ? "Reading the job…" : "Track this job" }}
      </button>
    </form>

    <p v-if="errorMessage" role="alert" class="mt-2 text-sm text-destructive">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { submitJobLink } from "../../lib/submitJobLink";

const {
  inputId,
  placeholder = "Paste a job link",
  secondaryOnChromium = false,
} = defineProps<{
  inputId: string;
  placeholder?: string;
  // The extension button is the main action on desktop Chromium, so this one steps back
  secondaryOnChromium?: boolean;
}>();

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
