<template>
  <div class="w-full">
    <p
      v-if="!analysis && roleParam"
      class="mb-4 text-sm text-muted-foreground text-center"
    >
      Checking a resume for a <span class="font-semibold text-foreground">{{ roleParam }}</span> role? Paste it in below.
    </p>
    <form
      v-if="!analysis"
      class="flex flex-col gap-6"
      @submit.prevent="handleSubmit"
    >
      <p
        v-if="prefilledFromExtension"
        class="rounded-field bg-secondary px-4 py-3 text-sm text-foreground"
      >
        Job description added from the page you were on.
        {{ resumeText ? "Check it, then run the match." : "Add your resume, then run the match." }}
      </p>
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2 min-h-11">
            <label for="resume-text" class="text-sm font-semibold text-foreground">
              Your resume
            </label>
            <label
              class="inline-flex items-center gap-2 h-11 rounded-full border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted cursor-pointer has-[:disabled]:opacity-60 has-[:disabled]:pointer-events-none"
            >
              <i
                :class="isReadingPdf ? 'ph ph-circle-notch animate-spin' : 'ph ph-upload-simple'"
                class="text-base"
                aria-hidden="true"
              ></i>
              <span class="max-w-[10rem] truncate" :title="uploadedFileName ?? undefined">{{ uploadLabel }}</span>
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
            class="h-56 lg:h-80 w-full resize-y rounded-card border border-input bg-card p-4 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          ></textarea>
          <p class="text-xs text-muted-foreground flex justify-between gap-2">
            <span v-if="resumeSource === 'pdf'">This is the text a parser gets from your PDF. Read the order.</span>
            <span v-else>PDFs are read in your browser, never uploaded.</span>
            <span :class="counterClass(resumeText)" class="tabular-nums shrink-0">
              {{ resumeText.length.toLocaleString("en-US") }} / {{ MAX_CHARS.toLocaleString("en-US") }}
            </span>
          </p>
          <label class="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              v-model="rememberResumeOnDevice"
              type="checkbox"
              class="h-4 w-4 accent-primary"
              @change="onRememberToggle"
            />
            Remember my resume in this browser, so the next job only needs a click
          </label>
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
            class="h-56 lg:h-80 w-full resize-y rounded-card border border-input bg-card p-4 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
          ref="submitButton"
          type="submit"
          :disabled="isSubmitting || isReadingPdf"
          class="inline-flex w-full sm:w-auto min-w-64 items-center justify-center gap-2 whitespace-nowrap text-base font-semibold h-13 rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none"
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

    <div v-else class="flex flex-col gap-6 pb-20 md:pb-0">
      <!-- A full aria-live region would read the entire report aloud; announce
           a one-line summary instead. -->
      <p class="sr-only" aria-live="polite">{{ resultSummary }}</p>

      <!-- Score + verdict -->
      <div class="rounded-card bg-card shadow-card dark:border dark:border-border p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
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
            <span class="font-display text-4xl font-extrabold tabular-nums" :class="scoreTone.text">{{ analysis.matchScore }}</span>
            <span class="text-xs text-muted-foreground">match</span>
          </div>
        </div>
        <div class="flex flex-col gap-2 text-center sm:text-left">
          <p class="text-sm font-bold" :class="scoreTone.text">
            {{ scoreTone.label }}
            <span class="text-muted-foreground font-normal">
              · {{ mustHaveSummary }}
            </span>
          </p>
          <h2 v-if="jobLabel" class="text-2xl font-extrabold text-foreground">{{ jobLabel }}</h2>
          <p class="text-muted-foreground">{{ analysis.verdict }}</p>
          <a
            :href="ctaHref"
            class="inline-flex items-center gap-1.5 self-center sm:self-start text-sm font-semibold text-primary hover:underline"
            @click="saveAndTrackCta('score_card')"
          >
            Save this job to my tracker
            <i class="ph ph-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>

      <!-- Parse check -->
      <div
        class="rounded-card border p-5 flex gap-3"
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
            <pre class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-field border border-border bg-card p-3 font-mono text-xs text-foreground">{{ submittedResume }}</pre>
          </details>
        </div>
      </div>

      <!-- Requirements -->
      <div class="rounded-card bg-card shadow-card dark:border dark:border-border p-6">
        <h3 class="text-lg font-bold text-foreground mb-4">Requirement by requirement</h3>
        <ul class="flex flex-col divide-y divide-border/60">
          <li
            v-for="requirement in analysis.requirements"
            :key="requirement.requirement"
            class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-3"
          >
            <span
              class="mt-0.5 inline-flex h-6 w-20 shrink-0 items-center justify-center gap-1 rounded-full text-xs font-semibold"
              :class="REQUIREMENT_TONES[requirement.status].pill"
            >
              <i :class="REQUIREMENT_TONES[requirement.status].icon" class="ph text-sm" aria-hidden="true"></i>
              {{ REQUIREMENT_TONES[requirement.status].label }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-[15px] font-semibold text-foreground">
                {{ requirement.requirement }}
                <span
                  v-if="requirement.importance === 'must-have'"
                  class="ml-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                >must-have</span>
              </p>
              <p v-if="requirement.evidence" class="mt-1 text-sm text-muted-foreground italic leading-relaxed">
                “{{ requirement.evidence }}”
              </p>
              <p v-else class="mt-1 text-sm text-muted-foreground italic">Not in your resume</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Missing keywords -->
      <div v-if="analysis.missingKeywords.length" class="rounded-card bg-card shadow-card dark:border dark:border-border p-6">
        <h3 class="text-lg font-bold text-foreground mb-3">Keywords from the posting that aren't in your resume</h3>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="missingKeyword in analysis.missingKeywords"
            :key="missingKeyword"
            class="px-3 py-1 text-sm font-medium rounded-full bg-destructive-soft text-destructive"
          >
            {{ missingKeyword }}
          </li>
        </ul>
        <p class="text-xs text-muted-foreground mt-3">Only add the ones that are true for you.</p>
      </div>

      <!-- Fixes -->
      <div class="rounded-card bg-card shadow-card dark:border dark:border-border p-6">
        <h3 class="text-lg font-bold text-foreground mb-4">3 places to fix before you apply</h3>
        <ol class="flex flex-col gap-5">
          <li v-for="(fix, index) in analysis.fixes" :key="index" class="flex gap-4">
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
              {{ index + 1 }}
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <p class="font-semibold text-foreground">{{ fix.gap }}</p>
              <p class="text-sm text-muted-foreground italic">{{ fix.where }}</p>
              <p class="text-sm text-muted-foreground">{{ fix.action }}</p>
            </div>
          </li>
        </ol>
      </div>

      <!-- CTA -->
      <div class="rounded-card bg-secondary p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-4">
        <div class="flex-1">
          <h3 class="text-xl font-extrabold text-foreground">Applying to this one? Don't lose track of it.</h3>
          <p class="text-[15px] text-soft-foreground mt-1">
            Sign up and {{ jobLabel || "this job" }} is already in your tracker, with this match
            check attached. Track status, interviews, and follow-ups. Free, no credit card, sign in
            with Google in one click.
          </p>
        </div>
        <a
          :href="ctaHref"
          class="hidden md:inline-flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-semibold h-12 rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90"
          @click="saveAndTrackCta('result_card')"
        >
          Save and track this job
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
          Check another job with the same resume
        </button>
      </div>

      <!-- Sticky CTA on mobile -->
      <div class="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3">
        <a
          :href="ctaHref"
          class="flex w-full items-center justify-center gap-2 text-sm font-semibold h-12 rounded-full bg-primary text-primary-foreground"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getFirebaseAuth, getFirebaseFunctions } from "../../lib/firebase";
import { savePendingToolApplication } from "../../lib/pendingToolApplication";
import { resumeUploadLabel } from "../../lib/resumeUpload";

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
// Opt-in: kept across tabs so the browser extension's "Check my match" needs no re-paste
const SAVED_RESUME_STORAGE_KEY = "oa-tool-resume-saved";
const LOADING_MESSAGES = [
  "Reading your resume…",
  "Reading the job description…",
  "Checking each requirement…",
  "Looking for evidence…",
  "Being honest with you…",
];
const REQUIREMENT_TONES: Record<RequirementStatus, { icon: string; label: string; pill: string }> = {
  matched: { icon: "ph-check", label: "Met", pill: "bg-success-soft text-success" },
  partial: { icon: "ph-circle-half", label: "Partly", pill: "bg-stage-interviewing-soft text-stage-interviewing-text" },
  missing: { icon: "ph-x", label: "Missing", pill: "bg-destructive-soft text-destructive" },
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
const rememberResumeOnDevice = ref(false);
const jobDescriptionLink = ref<string | null>(null);
const prefilledFromExtension = ref(false);
const submitButton = ref<HTMLButtonElement | null>(null);
const uploadedFileName = ref<string | null>(null);
let loadingTimer: ReturnType<typeof setInterval> | undefined;

const loadingMessage = computed(() => LOADING_MESSAGES[loadingMessageIndex.value]);
const uploadLabel = computed(() =>
  resumeUploadLabel({
    isReadingPdf: isReadingPdf.value,
    resumeSource: resumeSource.value,
    fileName: uploadedFileName.value,
  }),
);

const jobLabel = computed(() => {
  if (!analysis.value) return "";
  const { position, companyName } = analysis.value;
  if (position && companyName) return `${position} at ${companyName}`;
  return position || companyName;
});

const mustHaveStats = computed(() => {
  const mustHaves = analysis.value?.requirements.filter(
    (requirement) => requirement.importance === "must-have",
  ) ?? [];
  const matched = mustHaves.filter((requirement) => requirement.status === "matched").length;
  const partial = mustHaves.filter((requirement) => requirement.status === "partial").length;
  return { matched, partial, total: mustHaves.length };
});

const mustHaveSummary = computed(() => {
  const { matched, partial, total } = mustHaveStats.value;
  if (total === 0) return "";
  return partial > 0
    ? `${matched} of ${total} must-haves met, ${partial} partly`
    : `${matched} of ${total} must-haves met`;
});

// Announced to screen readers once a result is ready, instead of reading
// the entire report aloud.
const resultSummary = computed(() => {
  if (!analysis.value) return "";
  return `Match score ${analysis.value.matchScore}, ${mustHaveSummary.value}.`;
});

const scoreTone = computed(() => {
  const score = analysis.value?.matchScore ?? 0;
  const { matched, total } = mustHaveStats.value;
  // Never call it a "strong" match on the score alone: most must-haves also
  // need to be fully (not partially) met, or the label contradicts the count
  // right next to it.
  const strongEligible = total === 0 || matched / total >= 0.8;
  if (score >= 75 && strongEligible) return { label: "Strong match", text: "text-success", stroke: "stroke-success" };
  if (score >= 55) return { label: "Possible, with gaps", text: "text-stage-interviewing-text", stroke: "stroke-stage-interviewing" };
  return { label: "Long shot as it stands", text: "text-destructive", stroke: "stroke-destructive" };
});

const parseTone = computed(() => {
  const status = analysis.value?.parseCheck.status;
  if (status === "scrambled") {
    return {
      title: "Your resume text comes out scrambled",
      icon: "ph-warning-octagon",
      text: "text-destructive",
      box: "border-destructive/40 bg-destructive-soft",
    };
  }
  if (status === "issues") {
    return {
      title: "Parts of your resume don't read cleanly",
      icon: "ph-warning",
      text: "text-stage-interviewing-text",
      box: "border-stage-interviewing/40 bg-stage-interviewing-soft",
    };
  }
  return {
    title: "Your resume reads cleanly as plain text",
    icon: "ph-check-circle",
    text: "text-success",
    box: "border-success/30 bg-success-soft",
  };
});

// Set by ?role= on internal links (e.g. resume-keywords pages) so the tool can greet the visitor by role
const roleParam = computed(() => {
  const incoming = new URLSearchParams(pageSearch.value);
  return incoming.get("role") ?? "";
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
  return value.length >= MAX_CHARS * 0.95 ? "text-stage-interviewing-text" : "text-muted-foreground";
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
      ...(jobDescriptionLink.value ? { jobDescriptionLink: jobDescriptionLink.value } : {}),
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

// The resume stays in this tab, so "check another job" doesn't need a re-paste.
// It outlives the tab only if the visitor ticked "Remember my resume".
function rememberResume(value: string) {
  try {
    sessionStorage.setItem(RESUME_STORAGE_KEY, value);
    if (rememberResumeOnDevice.value) localStorage.setItem(SAVED_RESUME_STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable (private mode); the tool still works
  }
}

function onRememberToggle() {
  trackEvent("tool_remember_resume_toggled", { enabled: rememberResumeOnDevice.value });
  if (rememberResumeOnDevice.value) return;
  try {
    localStorage.removeItem(SAVED_RESUME_STORAGE_KEY);
  } catch {
    // Nothing stored
  }
}

function readSavedResume(): string {
  try {
    const saved = localStorage.getItem(SAVED_RESUME_STORAGE_KEY);
    if (saved) {
      rememberResumeOnDevice.value = true;
      return saved;
    }
    return sessionStorage.getItem(RESUME_STORAGE_KEY) ?? "";
  } catch {
    // Storage can be unavailable (private mode)
    return "";
  }
}

function webUrlOrNull(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

// The browser extension opens this page with #jd=<job description>&url=<posting>.
// A fragment never reaches the server, so the posting text isn't logged anywhere.
// It only fills the textarea; nothing runs until the visitor clicks Check.
function readExtensionHandoff() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const handedOff = params.get("jd")?.trim();
  if (!handedOff) return;

  jobDescription.value = handedOff.slice(0, MAX_CHARS);
  jobDescriptionLink.value = webUrlOrNull(params.get("url"));
  prefilledFromExtension.value = true;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  trackEvent("tool_prefilled", { source: "extension", job_description_chars: handedOff.length });
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
    uploadedFileName.value = file.name;
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
    // Collapse the static hero above this island into a single line so the
    // score lands in the first mobile viewport (the hero markup lives in
    // resume-job-match.astro, outside this component, for SEO)
    window.dispatchEvent(new CustomEvent("oa:tool-result", { detail: { label: jobLabel.value } }));
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
  jobDescriptionLink.value = null;
  prefilledFromExtension.value = false;
  errorMessage.value = null;
  trackEvent("tool_restarted");
  window.dispatchEvent(new CustomEvent("oa:tool-reset"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

watch(resumeText, (value, previous) => {
  // A manual edit after a PDF upload means the text is no longer the raw parse
  if (resumeSource.value === "pdf" && previous && Math.abs(value.length - previous.length) < 50) {
    resumeSource.value = "paste";
  }
});

onMounted(async () => {
  pageSearch.value = window.location.search;
  resumeText.value = readSavedResume();
  readExtensionHandoff();
  if (prefilledFromExtension.value && resumeText.value) {
    await nextTick();
    submitButton.value?.focus();
  }
});

onBeforeUnmount(stopLoadingMessages);
</script>
