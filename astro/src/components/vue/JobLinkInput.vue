<template>
  <div class="w-full">
    <form
      v-if="!textMode"
      @submit.prevent="handleSubmit"
      class="flex flex-col gap-2.5 sm:flex-row sm:items-center"
    >
      <!-- Fixed height on the wrapper, not the input: in a column a flex input can collapse to a strip -->
      <div
        class="flex h-[54px] w-full shrink-0 items-center gap-2.5 rounded-field border border-input bg-card px-4 sm:h-[52px] sm:w-auto sm:flex-1 sm:rounded-full focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
      >
        <i class="ph ph-link text-lg text-muted-foreground" aria-hidden="true"></i>
        <input
          :id="inputId"
          v-model="jobInput"
          type="text"
          required
          aria-label="Job posting link or description"
          autocomplete="off"
          inputmode="url"
          :placeholder="placeholder"
          class="h-full w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          :disabled="isSubmitting"
          @paste="onPaste"
        />
      </div>
      <button type="submit" :disabled="isSubmitting" :class="buttonClass">
        {{ isSubmitting ? "Reading the job…" : "Track this job" }}
      </button>
    </form>

    <!-- A pasted description, or the description a LinkedIn/Indeed link needs -->
    <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-2.5">
      <p v-if="blockedBoard" class="m-0 text-[14.5px] text-soft-foreground">
        {{ blockedBoardMessage(blockedBoard) }}
      </p>
      <textarea
        :id="inputId"
        ref="descriptionField"
        v-model="jobInput"
        required
        aria-label="Job description"
        :maxlength="MAX_DESCRIPTION_CHARS"
        placeholder="Paste the whole posting: title, company, responsibilities, requirements"
        class="h-44 w-full resize-y rounded-field border border-input bg-card px-4 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/30"
        :disabled="isSubmitting"
      ></textarea>
      <p v-if="keptLink" class="m-0 truncate text-sm text-muted-foreground">
        Link kept: {{ keptLink }}
      </p>
      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button type="submit" :disabled="isSubmitting" :class="buttonClass">
          {{ isSubmitting ? "Reading the description…" : "Track this job" }}
        </button>
        <button
          type="button"
          class="cursor-pointer self-center bg-transparent text-[15px] font-semibold text-secondary-foreground hover:underline sm:self-auto"
          :disabled="isSubmitting"
          @click="useLinkInstead"
        >
          Use a link instead
        </button>
      </div>
    </form>

    <p v-if="errorMessage" role="alert" class="mt-2 text-sm text-destructive">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from "vue";
import { submitJobDescription, submitJobLink } from "../../lib/submitJobLink";
import {
  MAX_DESCRIPTION_CHARS,
  blockedBoardMessage,
  blockedJobBoard,
  classifyJobInput,
  looksLikeDescription,
  type BlockedJobBoard,
} from "../../lib/jobInput";

const {
  inputId,
  placeholder = "Paste a job link or description",
  secondaryOnChromium = false,
} = defineProps<{
  inputId: string;
  placeholder?: string;
  // The extension button is the main action on desktop Chromium, so this one steps back
  secondaryOnChromium?: boolean;
}>();

const buttonClass = [
  "inline-flex h-[52px] w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-[26px] text-[16.5px] font-semibold disabled:pointer-events-none disabled:opacity-50 sm:w-auto",
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  secondaryOnChromium &&
    "chromium:border-input chromium:bg-card chromium:text-foreground chromium:hover:bg-muted",
];

const jobInput = ref("");
// A pasted description gets a text box; a one-line input would flatten it
const textMode = ref(false);
// A LinkedIn/Indeed link stays on the job while its description is pasted
const keptLink = ref<string | null>(null);
const blockedBoard = ref<BlockedJobBoard | null>(null);
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const descriptionField = useTemplateRef<HTMLTextAreaElement>("descriptionField");

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName, properties);
  }
}

async function switchToText({ text = "", link = null, board = null }: {
  text?: string;
  link?: string | null;
  board?: BlockedJobBoard | null;
}) {
  jobInput.value = text;
  keptLink.value = link;
  blockedBoard.value = board;
  textMode.value = true;
  errorMessage.value = null;
  await nextTick();
  descriptionField.value?.focus();
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData("text") ?? "";
  if (!looksLikeDescription(pasted)) return;
  event.preventDefault();
  switchToText({ text: pasted.trim() });
}

function useLinkInstead() {
  jobInput.value = keptLink.value ?? "";
  keptLink.value = null;
  blockedBoard.value = null;
  textMode.value = false;
  errorMessage.value = null;
}

async function handleSubmit() {
  errorMessage.value = null;
  const input = classifyJobInput(jobInput.value);

  if (input.kind === "link" && textMode.value) {
    errorMessage.value = "That's a link. Paste the job description itself.";
    return;
  }
  if (input.kind === "empty" || input.kind === "too-short") {
    errorMessage.value = textMode.value
      ? "That's too short to be a job description. Paste the whole posting."
      : "Paste a full link, or the whole job description.";
    return;
  }

  if (input.kind === "link") {
    const board = blockedJobBoard(input.url);
    if (board) {
      // Don't make them wait on a scrape that is going to fail
      trackEvent("job_board_shortcut_shown", { board, surface: "landing" });
      switchToText({ link: input.url, board });
      return;
    }
  }

  isSubmitting.value = true;
  const kind = input.kind === "link" ? "link" : "text";
  trackEvent("lp_job_parse_started", { input: kind });
  trackEvent("job_input_submitted", {
    input: kind,
    surface: "landing",
    ...(blockedBoard.value ? { board: blockedBoard.value } : {}),
  });

  const result = input.kind === "link"
    ? await submitJobLink(input.url)
    : await submitJobDescription(input.text, keptLink.value);
  if (!result.ok) {
    errorMessage.value = result.errorMessage;
    isSubmitting.value = false;
    return;
  }

  if (result.signedIn) trackEvent("lp_auth_skipped");
  window.location.href = result.redirectUrl;
}
</script>
