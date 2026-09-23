<template>
  <div class="w-full">
    <form
      v-if="!analysis"
      class="flex flex-col gap-6"
      @submit.prevent="handleSubmit"
    >
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2 min-h-11">
            <label for="resume-text" class="text-sm font-semibold text-foreground">
              Your resume
            </label>
            <label
              class="inline-flex items-center gap-2 h-11 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted cursor-pointer has-[:disabled]:opacity-60 has-[:disabled]:pointer-events-none"
            >
              <i :class="isReadingPdf ? 'ph ph-circle-notch animate-spin' : 'ph ph-file-pdf'" aria-hidden="true"></i>
              {{ isReadingPdf ? "Reading PDF..." : "Upload PDF" }}
              <input
                type="file"
                accept="application/pdf,.pdf"
                class="sr-only"
                :disabled="isSubmitting || isReadingPdf"
                @change="handlePdfUpload"
              />
            </label>
          </div>
          <textarea
            id="resume-text"
            v-model="resumeText"
            :maxlength="MAX_CHARS"
            :disabled="isSubmitting"
            required
            placeholder="Upload your PDF, or paste your resume text here."
            class="h-56 lg:h-80 w-full resize-y rounded-md border border-border/60 bg-background/80 p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          ></textarea>
          <p class="text-xs text-muted-foreground flex justify-between gap-2">
            <span v-if="resumeSource === 'pdf'">This is the text a parser gets from your PDF. Read the order.</span>
            <span v-else>PDFs are read in your browser, never uploaded.</span>
            <span :class="counterClass(resumeText)" class="tabular-nums shrink-0">
              {{ resumeText.length.toLocaleString("en-US") }} / {{ MAX_CHARS.toLocaleString("en-US") }}
            </span>
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center min-h-11">
            <label for="job-description" class="text-sm font-semibold text-foreground">
              Job description
            </label>
          </div>
          <textarea
            id="job-description"
            v-model="jobDescription"
            :maxlength="MAX_CHARS"
            :disabled="isSubmitting"
            required
            placeholder="Paste the full job posting: title, company, responsibilities, requirements."
            class="h-56 lg:h-80 w-full resize-y rounded-md border border-border/60 bg-background/80 p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          ></textarea>
          <p class="text-xs text-muted-foreground flex justify-end">
            <span :class="counterClass(jobDescription)" class="tabular-nums">
              {{ jobDescription.length.toLocaleString("en-US") }} / {{ MAX_CHARS.toLocaleString("en-US") }}
            </span>
          </p>
        </div>
      </div>

      <div class="flex flex-col items-center gap-3">
        <button
          type="submit"
          :disabled="isSubmitting || isReadingPdf"
          class="inline-flex w-full sm:w-auto min-w-64 items-center justify-center gap-2 whitespace-nowrap text-base font-semibold h-12 rounded-md px-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none shadow-lg shadow-primary/40"
        >
          <i v-if="isSubmitting" class="ph ph-circle-notch animate-spin" aria-hidden="true"></i>
          {{ isSubmitting ? loadingMessage : "Check my match" }}
        </button>
        <p v-if="errorMessage" role="alert" class="text-destructive text-sm text-center">
          {{ errorMessage }}
        </p>
        <p class="text-xs text-muted-foreground text-center max-w-lg">
          Free, no signup, takes about 15 seconds. Your resume is sent to Google Gemini for
          this one check and is never stored. It never rewrites your resume or invents experience.
        </p>
      </div>
    </form>

    <div v-else class="flex flex-col gap-6 pb-20 md:pb-0" aria-live="polite">
      <!-- Score + verdict -->
      <div class="rounded-lg border border-border/60 bg-card/80 p-6 flex flex-col sm:flex-row items-center gap-6">
        <div class="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 36 36" class="h-32 w-32 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9155" fill="none" stroke-width="3" class="stroke-muted" />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke-width="3"
              stroke-linecap="round"
              :stroke-dasharray="`${analysis.matchScore} 100`"
              :class="scoreTone.stroke"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-4xl font-bold tabular-nums" :class="scoreTone.text">{{ analysis.matchScore }}</span>
            <span class="text-xs text-muted-foreground">match</span>
          </div>
        </div>
        <div class="flex flex-col gap-2 text-center sm:text-left">
          <p class="text-sm font-semibold uppercase tracking-wide" :class="scoreTone.text">
            {{ scoreTone.label }}
            <span class="text-muted-foreground normal-case font-normal tracking-normal">
              · {{ mustHaveSummary }}
            </span>
          </p>
          <h2 v-if="jobLabel" class="text-xl font-bold text-foreground">{{ jobLabel }}</h2>
          <p class="text-muted-foreground">{{ analysis.verdict }}</p>
        </div>
      </div>

      <!-- Parse check -->
      <div
        class="rounded-lg border p-4 flex gap-3"
        :class="parseTone.box"
      >
        <i :class="[parseTone.icon, parseTone.text]" class="ph text-xl shrink-0" aria-hidden="true"></i>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold" :class="parseTone.text">{{ parseTone.title }}</p>
          <p v-if="analysis.parseCheck.note" class="text-sm text-muted-foreground mt-1">{{ analysis.parseCheck.note }}</p>
          <details class="mt-2 text-sm" @toggle="onParserViewToggle">
            <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
              See what a parser saw
            </summary>
            <pre class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background/80 p-3 font-mono text-xs text-foreground">{{ submittedResume }}</pre>
          </details>
        </div>
      </div>

      <!-- Requirements -->
      <div class="rounded-lg border border-border/60 bg-card/80 p-6">
        <h3 class="font-semibold text-foreground mb-4">Requirement by requirement</h3>
        <ul class="flex flex-col divide-y divide-border/60">
          <li
            v-for="requirement in analysis.requirements"
            :key="requirement.requirement"
            class="flex gap-3 py-3 first:pt-0 last:pb-0"
          >
            <i
              :class="REQUIREMENT_TONES[requirement.status].icon"
              class="ph text-lg shrink-0 mt-0.5"
              :aria-label="requirement.status"
            ></i>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-foreground">
                {{ requirement.requirement }}
                <span
                  v-if="requirement.importance === 'must-have'"
                  class="ml-1 whitespace-nowrap rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >must-have</span>
              </p>
              <p v-if="requirement.evidence" class="mt-1 text-xs text-muted-foreground border-l-2 border-border pl-2 italic">
                “{{ requirement.evidence }}”
              </p>
              <p v-else class="mt-1 text-xs text-rose-300/80">No evidence in your resume</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Missing keywords -->
      <div v-if="analysis.missingKeywords.length" class="rounded-lg border border-border/60 bg-card/80 p-6">
        <h3 class="font-semibold text-foreground mb-3">Keywords from the posting that aren't in your resume</h3>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="missingKeyword in analysis.missingKeywords"
            :key="missingKeyword"
            class="px-2.5 py-1 text-xs font-medium rounded-full border border-rose-400/40 bg-rose-500/10 text-rose-200"
          >
            {{ missingKeyword }}
          </li>
        </ul>
        <p class="text-xs text-muted-foreground mt-3">Only add the ones that are true for you.</p>
      </div>

      <!-- Fixes -->
      <div class="rounded-lg border border-border/60 bg-card/80 p-6">
        <h3 class="font-semibold text-foreground mb-4">3 places to fix before you apply</h3>
        <ol class="flex flex-col gap-5">
          <li v-for="(fix, index) in analysis.fixes" :key="index" class="flex gap-4">
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 text-sm font-bold text-primary">
              {{ index + 1 }}
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <p class="font-medium text-foreground">{{ fix.gap }}</p>
              <p class="text-xs text-muted-foreground border-l-2 border-border pl-2">{{ fix.where }}</p>
              <p class="text-sm text-muted-foreground">{{ fix.action }}</p>
            </div>
          </li>
        </ol>
      </div>

      <!-- CTA -->
      <div class="rounded-lg border border-primary/40 bg-linear-to-br from-primary/15 via-card to-card p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div class="flex-1">
          <h3 class="text-lg font-bold text-foreground">Applying to this one? Don't lose track of it.</h3>
          <p class="text-sm text-muted-foreground mt-1">
            Sign up and {{ jobLabel || "this job" }} is already in your tracker, with this match
            check attached. Track status, interviews, and follow-ups. Free, no credit card, sign in
            with Google in one click. Open source.
          </p>
        </div>
        <a
          :href="ctaHref"
          class="hidden md:inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold h-11 rounded-md px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/40"
          @click="saveAndTrackCta('result_card')"
        >
          Save and track this job
          <i class="ph ph-arrow-right" aria-hidden="true"></i>
        </a>
      </div>

      <div class="flex justify-center">
        <button
          type="button"
          class="inline-flex items-center gap-2 h-11 px-4 text-sm text-muted-foreground hover:text-foreground"
          @click="startOver"
        >
          <i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i>
          Check another job with the same resume
        </button>
      </div>

      <!-- Sticky CTA on mobile -->
      <div class="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3">
        <a
          :href="ctaHref"
          class="flex w-full items-center justify-center gap-2 text-sm font-semibold h-12 rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/40"
          @click="saveAndTrackCta('mobile_sticky')"
        >
          Save and track this job, free
          <i class="ph ph-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getFirebaseAuth, getFirebaseFunctions } from "../../lib/firebase";
import { savePendingToolApplication } from "../../lib/pendingToolApplication";

type RequirementStatus = "matched" | "partial" | "missing";

type MatchAnalysis = {
  companyName: string;
  position: string;
  parseCheck: { status: "clean" | "issues" | "scrambled"; note: string };
  matchScore: number;
  verdict: string;
  requirements: {
    requirement: string;
    status: RequirementStatus;
    importance: "must-have" | "nice-to-have";
    evidence: string;
  }[];
  missingKeywords: string[];
  fixes: { gap: string; where: string; action: string }[];
  technologies: string[];
};

type MatchResponse = { analysis: MatchAnalysis };

// Keep in sync with functions/src/lib/matchTool.ts
const MIN_CHARS = 200;
const MAX_CHARS = 15000;
const TOOL_NAME = "resume_job_match";
const RESUME_STORAGE_KEY = "oa-tool-resume";
const LOADING_MESSAGES = [
  "Reading your resume...",
  "Reading the job description...",
  "Checking each requirement...",
  "Looking for evidence...",
  "Being honest with you...",
];
const REQUIREMENT_TONES: Record<RequirementStatus, { icon: string }> = {
  matched: { icon: "ph-check-circle text-emerald-400" },
  partial: { icon: "ph-circle-half text-amber-400" },
  missing: { icon: "ph-x-circle text-rose-400" },
};

const spaBase = import.meta.env.PUBLIC_SPA_BASE_URL || "/app";

const resumeText = ref("");
const resumeSource = ref<"paste" | "pdf">("paste");
const submittedResume = ref("");
const jobDescription = ref("");
const isSubmitting = ref(false);
const isReadingPdf = ref(false);
const errorMessage = ref<string | null>(null);
const analysis = ref<MatchAnalysis | null>(null);
const submittedJobDescription = ref("");
const loadingMessageIndex = ref(0);
const pageSearch = ref("");
let loadingTimer: ReturnType<typeof setInterval> | undefined;

const loadingMessage = computed(() => LOADING_MESSAGES[loadingMessageIndex.value]);

const jobLabel = computed(() => {
  if (!analysis.value) return "";
  const { position, companyName } = analysis.value;
  if (position && companyName) return `${position} at ${companyName}`;
  return position || companyName;
});

const mustHaveSummary = computed(() => {
  const mustHaves = analysis.value?.requirements.filter(
    (requirement) => requirement.importance === "must-have",
  ) ?? [];
  const met = mustHaves.filter((requirement) => requirement.status === "matched").length;
  return `${met} of ${mustHaves.length} must-haves clearly met`;
});

const scoreTone = computed(() => {
  const score = analysis.value?.matchScore ?? 0;
  if (score >= 75) return { label: "Strong match", text: "text-emerald-400", stroke: "stroke-emerald-400" };
  if (score >= 55) return { label: "Possible, with gaps", text: "text-amber-400", stroke: "stroke-amber-400" };
  return { label: "Long shot as it stands", text: "text-rose-400", stroke: "stroke-rose-400" };
});

const parseTone = computed(() => {
  const status = analysis.value?.parseCheck.status;
  if (status === "scrambled") {
    return {
      title: "Your resume text comes out scrambled",
      icon: "ph-warning-octagon",
      text: "text-rose-300",
      box: "border-rose-400/40 bg-rose-500/10",
    };
  }
  if (status === "issues") {
    return {
      title: "Parts of your resume don't read cleanly",
      icon: "ph-warning",
      text: "text-amber-300",
      box: "border-amber-400/40 bg-amber-500/10",
    };
  }
  return {
    title: "Your resume reads cleanly as plain text",
    icon: "ph-check-circle",
    text: "text-emerald-300",
    box: "border-emerald-400/30 bg-emerald-500/5",
  };
});

// Carry incoming UTM params into signup so attribution survives the tool
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

function counterClass(value: string) {
  return value.length >= MAX_CHARS * 0.95 ? "text-amber-400" : "text-muted-foreground";
}

function trackEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName, { tool: TOOL_NAME, ...properties });
  }
}

// Runs before the link navigates, so the app finds the job after sign-in
function saveAndTrackCta(placement: string) {
  if (analysis.value) {
    const { companyName, position, technologies, ...match } = analysis.value;
    const saved = savePendingToolApplication({
      companyName,
      position,
      technologies,
      jobDescription: submittedJobDescription.value,
      match: {
        matchScore: match.matchScore,
        verdict: match.verdict,
        parseCheck: match.parseCheck,
        requirements: match.requirements,
        missingKeywords: match.missingKeywords,
        fixes: match.fixes,
      },
    });
    if (!saved) trackEvent("tool_handoff_failed");
  }
  trackEvent("tool_cta_clicked", {
    cta: "track_application",
    placement,
    match_score: analysis.value?.matchScore,
  });
}

function onParserViewToggle(event: Event) {
  if ((event.target as HTMLDetailsElement).open) {
    trackEvent("tool_parser_view_opened", { parse_status: analysis.value?.parseCheck.status });
  }
}

// The resume stays in this tab only, so "check another job" doesn't need a re-paste
function rememberResume(value: string) {
  try {
    sessionStorage.setItem(RESUME_STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable (private mode); the tool still works
  }
}

async function handlePdfUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  errorMessage.value = null;
  if (file.size > 10 * 1024 * 1024) {
    errorMessage.value = "That PDF is over 10 MB. Try exporting a smaller one, or paste the text.";
    return;
  }

  isReadingPdf.value = true;
  try {
    const { extractPdfText } = await import("../../lib/pdfText");
    const text = await extractPdfText(file);
    if (text.length < MIN_CHARS) {
      errorMessage.value = "We couldn't pull readable text out of that PDF. If it's a scan or an image, a resume parser can't read it either. Paste the text instead.";
      trackEvent("tool_pdf_unreadable");
      return;
    }
    resumeText.value = text.slice(0, MAX_CHARS);
    resumeSource.value = "pdf";
    trackEvent("tool_pdf_uploaded", { chars: text.length });
  } catch {
    errorMessage.value = "We couldn't read that PDF. Paste the text instead.";
    trackEvent("tool_pdf_unreadable");
  } finally {
    isReadingPdf.value = false;
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
  if (resumeText.value.trim().length < MIN_CHARS) {
    errorMessage.value = "Your resume looks too short. Paste the full text.";
    return;
  }
  if (jobDescription.value.trim().length < MIN_CHARS) {
    errorMessage.value = "The job description looks too short. Paste the full posting.";
    return;
  }

  isSubmitting.value = true;
  loadingMessageIndex.value = 0;
  loadingTimer = setInterval(() => {
    loadingMessageIndex.value = Math.min(loadingMessageIndex.value + 1, LOADING_MESSAGES.length - 1);
  }, 3000);
  trackEvent("tool_submitted", { resume_source: resumeSource.value });

  try {
    await getFirebaseAuth();
    const fns = await getFirebaseFunctions();
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<{ resumeText: string; jobDescription: string }, MatchResponse>(
      fns,
      "matchResumeTool",
      { timeout: 70000 },
    );
    const result = await callable({
      resumeText: resumeText.value,
      jobDescription: jobDescription.value,
    });

    submittedResume.value = resumeText.value;
    submittedJobDescription.value = jobDescription.value.trim();
    analysis.value = result.data.analysis;
    rememberResume(resumeText.value);
    trackEvent("tool_used", {
      match_score: result.data.analysis.matchScore,
      parse_status: result.data.analysis.parseCheck.status,
      missing_keywords: result.data.analysis.missingKeywords.length,
      resume_source: resumeSource.value,
      resume_chars: resumeText.value.length,
      job_description_chars: jobDescription.value.length,
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
  // Keep the resume so checking another job only needs a new description
  analysis.value = null;
  jobDescription.value = "";
  errorMessage.value = null;
  trackEvent("tool_restarted");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

watch(resumeText, (value, previous) => {
  // A manual edit after a PDF upload means the text is no longer the raw parse
  if (resumeSource.value === "pdf" && previous && Math.abs(value.length - previous.length) < 50) {
    resumeSource.value = "paste";
  }
});

onMounted(() => {
  pageSearch.value = window.location.search;
  try {
    resumeText.value = sessionStorage.getItem(RESUME_STORAGE_KEY) ?? "";
  } catch {
    // Storage can be unavailable (private mode)
  }
});

onBeforeUnmount(stopLoadingMessages);
</script>
