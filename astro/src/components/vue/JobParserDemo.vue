<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useJobParserDemo } from "./useJobParserDemo";

const { state, parsedData, errorMessage, start, reset } = useJobParserDemo();

const url = ref("");

const isValidUrl = computed(() => {
  if (!url.value.trim()) return false;
  try {
    new URL(url.value.trim());
    return true;
  } catch {
    return false;
  }
});

const isLoading = computed(
  () =>
    state.value === "initializing" ||
    state.value === "fetching" ||
    state.value === "waiting",
);

function handleSubmit() {
  if (!isValidUrl.value || isLoading.value) return;
  start(url.value.trim());
}

function handleReset() {
  url.value = "";
  reset();
}

function handleTryAnother() {
  url.value = "";
  reset();
}

// Rotating loading messages
const loadingMessages = [
  "Opening browser...",
  "Navigating to the job page...",
  "Reading the job description...",
  "Extracting company details...",
  "Identifying tech stack...",
  "Finalizing results...",
];

const currentMessageIndex = ref(0);
let messageInterval: ReturnType<typeof setInterval> | null = null;

watch(isLoading, (loading) => {
  if (loading) {
    currentMessageIndex.value = 0;
    messageInterval = setInterval(() => {
      currentMessageIndex.value =
        (currentMessageIndex.value + 1) % loadingMessages.length;
    }, 3500);
  } else {
    if (messageInterval) {
      clearInterval(messageInterval);
      messageInterval = null;
    }
  }
});

onUnmounted(() => {
  if (messageInterval) {
    clearInterval(messageInterval);
  }
});
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <!-- Idle State -->
    <div v-if="state === 'idle'" class="space-y-4">
      <form @submit.prevent="handleSubmit" class="flex gap-3">
        <input
          v-model="url"
          type="url"
          placeholder="https://jobs.example.com/senior-engineer"
          class="flex-1 h-11 rounded-md border border-border/60 bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        />
        <button
          type="submit"
          :disabled="!isValidUrl"
          class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-11 rounded-md px-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 transition-colors shadow-lg shadow-primary/40"
        >
          Parse Job
        </button>
      </form>
      <p class="text-sm text-muted-foreground text-center">
        Try it free &mdash; no signup required
      </p>
    </div>

    <!-- Loading State -->
    <div
      v-else-if="isLoading"
      class="rounded-lg border border-border/60 bg-card/80 shadow-sm backdrop-blur p-8 space-y-6"
    >
      <div class="flex flex-col items-center gap-4">
        <!-- Spinner -->
        <div
          class="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary"
        ></div>
        <!-- Rotating message -->
        <p class="text-sm text-muted-foreground animate-pulse">
          {{ loadingMessages[currentMessageIndex] }}
        </p>
      </div>
      <!-- Progress bar -->
      <div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          class="h-full bg-primary rounded-full animate-progress"
        ></div>
      </div>
    </div>

    <!-- Ready State -->
    <div
      v-else-if="state === 'ready' && parsedData"
      class="rounded-lg border border-border/60 bg-card/80 shadow-sm backdrop-blur p-6 space-y-5"
    >
      <!-- Header: logo + position + company -->
      <div class="flex items-start gap-4">
        <div
          v-if="parsedData.companyLogoUrl"
          class="h-12 w-12 flex-shrink-0 rounded-lg border border-border/40 bg-background overflow-hidden"
        >
          <img
            :src="parsedData.companyLogoUrl"
            :alt="parsedData.companyName || 'Company logo'"
            class="h-full w-full object-contain"
          />
        </div>
        <div
          v-else
          class="h-12 w-12 flex-shrink-0 rounded-lg border border-border/40 bg-muted flex items-center justify-center"
        >
          <span class="text-lg font-bold text-muted-foreground">
            {{ (parsedData.companyName || "?")[0].toUpperCase() }}
          </span>
        </div>
        <div class="min-w-0">
          <h3 class="text-lg font-semibold leading-tight truncate">
            {{ parsedData.position || "Position" }}
          </h3>
          <p class="text-sm text-muted-foreground truncate">
            {{ parsedData.companyName || "Company" }}
          </p>
        </div>
      </div>

      <!-- Badges: remote policy, employment type -->
      <div
        v-if="parsedData.remotePolicy || parsedData.employmentType"
        class="flex flex-wrap gap-2"
      >
        <span
          v-if="parsedData.remotePolicy"
          class="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
        >
          {{ parsedData.remotePolicy }}
        </span>
        <span
          v-if="parsedData.employmentType"
          class="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
        >
          {{ parsedData.employmentType }}
        </span>
      </div>

      <!-- Tech stack -->
      <div v-if="parsedData.technologies?.length" class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tech Stack
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tech in parsedData.technologies"
            :key="tech"
            class="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {{ tech }}
          </span>
        </div>
      </div>

      <!-- CTAs -->
      <div class="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-border/40">
        <a
          href="/app"
          class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-10 rounded-md px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full sm:w-auto"
        >
          Sign up to save this
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="ml-1"
          >
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </a>
        <button
          @click="handleTryAnother"
          class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium h-10 rounded-md px-6 border border-border/60 bg-background text-foreground hover:bg-muted transition-colors w-full sm:w-auto"
        >
          Try another link
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="state === 'error'"
      class="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4"
    >
      <p class="text-sm text-destructive">
        {{ errorMessage || "Something went wrong. Please try again." }}
      </p>
      <button
        @click="handleReset"
        class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium h-10 rounded-md px-6 border border-border/60 bg-background text-foreground hover:bg-muted transition-colors"
      >
        Try again
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes progress {
  0% {
    width: 0%;
  }
  50% {
    width: 70%;
  }
  100% {
    width: 95%;
  }
}

.animate-progress {
  animation: progress 30s ease-out forwards;
}
</style>
