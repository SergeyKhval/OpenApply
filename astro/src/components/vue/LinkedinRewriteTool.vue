<template>
  <div class="w-full">
    <form v-if="!result" class="flex flex-col gap-6" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 min-h-11">
          <label for="li-headline" class="text-sm font-semibold text-foreground">Your current headline</label>
          <span :class="counterClass(headline, MAX_HEADLINE_CHARS)" class="text-xs tabular-nums shrink-0">
            {{ headline.length }} / {{ MAX_HEADLINE_CHARS }}
          </span>
        </div>
        <input
          id="li-headline"
          v-model="headline"
          type="text"
          :maxlength="MAX_HEADLINE_CHARS"
          :disabled="isSubmitting"
          required
          placeholder="e.g. Frontend Engineer at Acme Corp"
          class="h-13 w-full rounded-card border border-input bg-card px-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 min-h-11">
          <label for="li-about" class="text-sm font-semibold text-foreground">Your current About section</label>
          <span :class="counterClass(about, MAX_ABOUT_CHARS)" class="text-xs tabular-nums shrink-0">
            {{ about.length.toLocaleString("en-US") }} / {{ MAX_ABOUT_CHARS.toLocaleString("en-US") }}
          </span>
        </div>
        <textarea
          id="li-about"
          v-model="about"
          :maxlength="MAX_ABOUT_CHARS"
          :disabled="isSubmitting"
          required
          placeholder="Paste your LinkedIn About section. Paragraph breaks are kept."
          class="h-56 lg:h-72 w-full resize-y rounded-card border border-input bg-card p-4 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        ></textarea>
      </div>

      <div class="flex flex-col gap-2">
        <label for="li-target-role" class="text-sm font-semibold text-foreground">
          Target role <span class="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="li-target-role"
          v-model="targetRole"
          type="text"
          :maxlength="MAX_TARGET_ROLE_CHARS"
          :disabled="isSubmitting"
          placeholder="e.g. Senior Backend Engineer"
          class="h-13 w-full rounded-card border border-input bg-card px-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <p class="text-xs text-muted-foreground">
          Helps us reorder what you already wrote. We won't claim a title, skill, or seniority level you didn't state.
        </p>
      </div>

      <div class="flex flex-col items-center gap-3">
        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex w-full sm:w-auto min-w-64 items-center justify-center gap-2 whitespace-nowrap text-base font-semibold h-13 rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none"
        >
          <i v-if="isSubmitting" class="ph ph-circle-notch animate-spin" aria-hidden="true"></i>
          {{ isSubmitting ? loadingMessage : "Rewrite my profile" }}
        </button>
        <p v-if="errorMessage" role="alert" class="text-destructive text-sm text-center">{{ errorMessage }}</p>
        <p class="text-xs text-muted-foreground text-center max-w-lg">
          Free, no signup, takes about 15 seconds. Nothing is stored. It only uses facts already in your text,
          it never invents a skill, employer, number, or title.
        </p>
      </div>
    </form>

    <div v-else class="flex flex-col gap-6 pb-20 md:pb-0">
      <p class="sr-only" aria-live="polite">{{ resultSummary }}</p>

      <div class="rounded-card bg-card shadow-card dark:border dark:border-border p-6 sm:p-8 flex flex-col gap-3">
        <p class="text-sm font-bold text-success">
          <i class="ph ph-check-circle" aria-hidden="true"></i>
          {{ keptCount }} of {{ totalCount }} lines kept your wording
        </p>
        <p class="text-muted-foreground">{{ result.why }}</p>
      </div>

      <!-- Headline -->
      <div class="rounded-card bg-card shadow-card dark:border dark:border-border p-6">
        <div class="flex items-center justify-between gap-2 mb-3">
          <h3 class="text-lg font-bold text-foreground">Headline</h3>
          <span v-if="!result.headline.changed" class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            <i class="ph ph-lock-simple" aria-hidden="true"></i>
            Kept your wording
          </span>
        </div>
        <p class="text-[15px] text-foreground leading-relaxed">{{ result.headline.text }}</p>
        <button
          type="button"
          class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          @click="copyText(result.headline.text, 'headline')"
        >
          <i class="ph ph-copy" aria-hidden="true"></i>
          {{ copiedField === "headline" ? "Copied" : "Copy headline" }}
        </button>
      </div>

      <!-- About -->
      <div class="rounded-card bg-card shadow-card dark:border dark:border-border p-6">
        <div class="flex items-center justify-between gap-2 mb-4">
          <h3 class="text-lg font-bold text-foreground">About</h3>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            @click="copyText(fullAboutText, 'about')"
          >
            <i class="ph ph-copy" aria-hidden="true"></i>
            {{ copiedField === "about" ? "Copied" : "Copy whole About" }}
          </button>
        </div>
        <div class="flex flex-col gap-4">
          <div v-for="line in result.about" :key="line.id">
            <span
              v-if="!line.changed"
              class="mb-1 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
            >
              <i class="ph ph-lock-simple" aria-hidden="true"></i>
              Kept your wording
            </span>
            <p class="text-[15px] text-foreground leading-relaxed whitespace-pre-line">{{ line.text }}</p>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="rounded-card bg-secondary p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-4">
        <div class="flex-1">
          <h3 class="text-xl font-extrabold text-foreground">Applying to jobs next?</h3>
          <p class="text-[15px] text-soft-foreground mt-1">
            OpenApply tracks every application free, with an honest AI match check against each job description,
            the same never-invents-evidence check that ran on this rewrite.
          </p>
        </div>
        <a
          :href="ctaHref"
          class="hidden md:inline-flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-semibold h-12 rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90"
          @click="trackCta('result_card')"
        >
          Start tracking for free
          <i class="ph ph-arrow-right" aria-hidden="true"></i>
        </a>
      </div>

      <div class="flex justify-center">
        <button
          type="button"
          class="inline-flex items-center gap-2 h-11 px-4 rounded-full text-sm font-semibold text-soft-foreground hover:bg-muted hover:text-foreground"
          @click="startOver"
        >
          <i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i>
          Rewrite another version
        </button>
      </div>

      <!-- Sticky CTA on mobile -->
      <div class="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3">
        <a
          :href="ctaHref"
          class="flex w-full items-center justify-center gap-2 text-sm font-semibold h-12 rounded-full bg-primary text-primary-foreground"
          @click="trackCta('mobile_sticky')"
        >
          Start tracking applications, free
          <i class="ph ph-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { getFirebaseAuth, getFirebaseFunctions } from "../../lib/firebase";

type RewriteLineVerdict = {
  id: string;
  original: string;
  text: string;
  changed: boolean;
  revertReason?: string;
};

type RewriteResult = {
  why: string;
  headline: RewriteLineVerdict;
  about: RewriteLineVerdict[];
  stats: { proposed: number; changed: number; kept: number };
};

type RewriteResponse = { result: RewriteResult };

// Keep in sync with functions/src/lib/linkedinRewriteTool.ts
const MIN_HEADLINE_CHARS = 10;
const MAX_HEADLINE_CHARS = 220;
const MIN_ABOUT_CHARS = 40;
const MAX_ABOUT_CHARS = 2600;
const MAX_TARGET_ROLE_CHARS = 100;
const TOOL_NAME = "linkedin_rewrite";
const LOADING_MESSAGES = [
  "Reading your headline…",
  "Reading your About section…",
  "Checking every line for invented facts…",
  "Being honest with you…",
];

const spaBase = import.meta.env.PUBLIC_SPA_BASE_URL || "/app";

const headline = ref("");
const about = ref("");
const targetRole = ref("");
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const result = ref<RewriteResult | null>(null);
const pageSearch = ref("");
const copiedField = ref<string | null>(null);
const loadingMessageIndex = ref(0);
let loadingTimer: ReturnType<typeof setInterval> | undefined;
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const loadingMessage = computed(() => LOADING_MESSAGES[loadingMessageIndex.value]);
const totalCount = computed(() => (result.value ? result.value.stats.proposed : 0));
const keptCount = computed(() => (result.value ? result.value.stats.kept : 0));
const fullAboutText = computed(() => (result.value ? result.value.about.map((line) => line.text).join("\n\n") : ""));

const resultSummary = computed(() => {
  if (!result.value) return "";
  return `Rewrite ready. ${keptCount.value} of ${totalCount.value} lines kept your original wording.`;
});

const ctaHref = computed(() => {
  const params = new URLSearchParams({ from: "tool" });
  const incoming = new URLSearchParams(pageSearch.value);
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  if (incoming.has("utm_source")) {
    utmKeys.forEach((key) => {
      const value = incoming.get(key);
      if (value) params.set(key, value);
    });
  } else {
    params.set("utm_source", "tool");
    params.set("utm_medium", "cta");
    params.set("utm_campaign", TOOL_NAME);
  }
  return `${spaBase}/?${params}`;
});

function counterClass(value: string, max: number) {
  return value.length >= max * 0.95 ? "text-stage-interviewing-text" : "text-muted-foreground";
}

function trackEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName, { tool: TOOL_NAME, ...properties });
  }
}

function trackCta(placement: string) {
  trackEvent("tool_cta_clicked", { cta: "start_tracking", placement });
}

async function copyText(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedField.value = field;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copiedField.value = null), 2000);
    trackEvent("tool_result_copied", { field });
  } catch {
    // Clipboard can be blocked; the text is still selectable
  }
}

function stopLoadingMessages() {
  if (loadingTimer) clearInterval(loadingTimer);
  loadingTimer = undefined;
}

function errorMessageFor(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : "";
  if (["functions/resource-exhausted", "functions/invalid-argument", "functions/internal"].includes(code) && message) {
    return message;
  }
  if (code === "functions/deadline-exceeded") {
    return "That took too long. Give it another try.";
  }
  if (message.includes("network") || message.includes("fetch") || code === "functions/unavailable") {
    return "Looks like the internet gremlins got in the way. Check your connection and try again.";
  }
  return "Something went sideways on our end. Give it another try.";
}

async function handleSubmit() {
  errorMessage.value = null;
  if (headline.value.trim().length < MIN_HEADLINE_CHARS) {
    errorMessage.value = "Your headline looks too short. Paste the whole thing.";
    return;
  }
  if (about.value.trim().length < MIN_ABOUT_CHARS) {
    errorMessage.value = "Your About section looks too short. Paste the whole thing.";
    return;
  }

  isSubmitting.value = true;
  loadingMessageIndex.value = 0;
  loadingTimer = setInterval(() => {
    loadingMessageIndex.value = Math.min(loadingMessageIndex.value + 1, LOADING_MESSAGES.length - 1);
  }, 3000);
  trackEvent("tool_submitted", { has_target_role: Boolean(targetRole.value.trim()) });

  try {
    await getFirebaseAuth();
    const fns = await getFirebaseFunctions();
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<
      { headline: string; about: string; targetRole: string },
      RewriteResponse
    >(fns, "rewriteLinkedinProfile", { timeout: 70000 });
    const response = await callable({
      headline: headline.value,
      about: about.value,
      targetRole: targetRole.value,
    });

    result.value = response.data.result;
    window.dispatchEvent(new CustomEvent("oa:tool-result", { detail: {} }));
    trackEvent("tool_used", {
      kept: response.data.result.stats.kept,
      changed: response.data.result.stats.changed,
      has_target_role: Boolean(targetRole.value.trim()),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    errorMessage.value = errorMessageFor(err);
    trackEvent("tool_error", { code: (err as { code?: string })?.code ?? "unknown" });
  } finally {
    stopLoadingMessages();
    isSubmitting.value = false;
  }
}

function startOver() {
  result.value = null;
  errorMessage.value = null;
  trackEvent("tool_restarted");
  window.dispatchEvent(new CustomEvent("oa:tool-reset"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(() => {
  pageSearch.value = window.location.search;
});

onBeforeUnmount(() => {
  stopLoadingMessages();
  if (copyTimer) clearTimeout(copyTimer);
});
</script>
