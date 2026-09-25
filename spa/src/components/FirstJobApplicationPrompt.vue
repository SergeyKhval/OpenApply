<!-- First run: one action per browser. Desktop Chrome/Edge get the
     extension (once it has a store link, VITE_EXTENSION_URL); everyone else,
     or anyone who prefers, pastes a link or the description itself.
     Owner: no import, no checklist. -->
<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col items-center gap-5 rounded-card bg-card px-6 py-10 text-center shadow-card dark:border dark:border-border sm:px-10"
  >
    <span class="grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground">
      <PhPuzzlePiece v-if="showExtension" :size="26" />
      <PhLink v-else :size="26" />
    </span>
    <div class="space-y-2">
      <h2 class="text-2xl font-extrabold text-foreground sm:text-3xl">Save your first job</h2>
      <p v-if="showExtension" class="text-[15px] text-soft-foreground">
        Add the extension, open any job posting, and click <b class="text-foreground">Save to OpenApply</b>. It reads the job from the page for you.
      </p>
      <p v-else class="text-[15px] text-soft-foreground">
        Paste the link to a job you're interested in, or its description. We'll fill in the company, role and details.
      </p>
    </div>

    <template v-if="showExtension">
      <Button size="lg" as-child>
        <a :href="extensionUrl" target="_blank" rel="noopener noreferrer" @click="trackExtensionClick">
          <PhGoogleChromeLogo />
          Add to Chrome, it's free
        </a>
      </Button>
      <button
        type="button"
        class="cursor-pointer text-[15px] font-semibold text-secondary-foreground hover:underline"
        @click="preferPaste = true"
      >
        or paste a link or description instead
      </button>
    </template>

    <template v-else>
      <form
        v-if="!textMode"
        class="flex w-full flex-col gap-2 sm:flex-row"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <Input
          v-model="jobInput"
          type="text"
          inputmode="url"
          autocomplete="off"
          :autofocus="shouldAutofocus"
          aria-label="Job posting link or description"
          :aria-invalid="!!errorMessage"
          aria-describedby="job-link-error"
          placeholder="Paste a job link or description"
          :class="['h-12 sm:flex-1', errorMessage && 'border-destructive']"
          @paste="onPaste"
        />
        <Button type="submit" size="lg" class="shrink-0">Save job</Button>
      </form>
      <form v-else class="flex w-full flex-col gap-2" novalidate @submit.prevent="handleSubmit">
        <Textarea
          ref="descriptionField"
          v-model="jobInput"
          :maxlength="MAX_DESCRIPTION_CHARS"
          aria-label="Job description"
          :aria-invalid="!!errorMessage"
          aria-describedby="job-link-error"
          placeholder="Paste the whole posting: title, company, responsibilities, requirements"
          class="min-h-40 max-h-72 text-left"
          :disabled="isSubmitting"
        />
        <Button type="submit" size="lg" :disabled="isSubmitting">
          <PhSpinner v-if="isSubmitting" class="animate-spin" />
          {{ isSubmitting ? "Reading the description…" : "Save job" }}
        </Button>
      </form>
      <p v-if="errorMessage" id="job-link-error" role="alert" class="-mt-3 text-xs text-destructive">
        {{ errorMessage }}
      </p>
      <button
        v-if="textMode"
        type="button"
        class="cursor-pointer text-[15px] font-semibold text-secondary-foreground hover:underline"
        @click="useLinkInstead"
      >
        or paste a link instead
      </button>
      <button
        type="button"
        class="cursor-pointer text-[15px] font-semibold text-secondary-foreground hover:underline"
        v-else
        @click="openAddDialog({ 'add-mode': 'manual' })"
      >
        or add one by hand
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PhGoogleChromeLogo, PhLink, PhPuzzlePiece, PhSpinner } from "@phosphor-icons/vue";
import { isDesktopChromium } from "@/lib/browser";
import { trackEvent } from "@/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useJobIngestion } from "@/composables/useJobIngestion";
import { MAX_DESCRIPTION_CHARS, classifyJobInput, looksLikeDescription } from "@/lib/jobInput";

const {
  extensionUrl = import.meta.env.VITE_EXTENSION_URL,
  desktopChromium = isDesktopChromium(),
} = defineProps<{ extensionUrl?: string; desktopChromium?: boolean }>();

const router = useRouter();
const route = useRoute();

// Extension first only where it installs and once it has a store link
const preferPaste = ref(false);
const showExtension = computed(() => Boolean(extensionUrl) && desktopChromium && !preferPaste.value);

function trackExtensionClick() {
  trackEvent("extension_install_clicked", { from: "first_run" });
}

const jobInput = ref("");
// A pasted description gets a text box; a one-line input would flatten it
const textMode = ref(false);
const errorMessage = ref<string | null>(null);
const descriptionField = useTemplateRef<InstanceType<typeof Textarea>>("descriptionField");

const { start: startIngestion, errorMessage: ingestionError } = useJobIngestion();
const isSubmitting = ref(false);

// Autofocus is desktop-only: on mobile it pops the keyboard open over the
// explanation before the user has read it.
const shouldAutofocus =
  typeof window !== "undefined" && (window.matchMedia?.("(pointer: fine)").matches ?? false);

function openAddDialog(extraQuery: Record<string, string>) {
  router.replace({
    query: { ...route.query, "dialog-name": "add-job-application", ...extraQuery },
  });
}

async function switchToText(text: string) {
  jobInput.value = text;
  textMode.value = true;
  errorMessage.value = null;
  await nextTick();
  (descriptionField.value?.$el as HTMLTextAreaElement | undefined)?.focus();
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData("text") ?? "";
  if (!looksLikeDescription(pasted)) return;
  event.preventDefault();
  switchToText(pasted.trim());
}

function useLinkInstead() {
  jobInput.value = "";
  textMode.value = false;
  errorMessage.value = null;
}

async function handleSubmit() {
  errorMessage.value = null;
  const input = classifyJobInput(jobInput.value);

  if (input.kind === "link") {
    if (textMode.value) {
      errorMessage.value = "That's a link. Paste the job description itself, or switch back to a link.";
      return;
    }
    // The dialog reads the page, or for LinkedIn/Indeed asks for the description
    openAddDialog({ "job-link": input.url });
    jobInput.value = "";
    return;
  }

  if (input.kind !== "text") {
    errorMessage.value = textMode.value
      ? "That's too short to be a job description. Paste the whole posting."
      : "Paste a full link, starting with https://, or the whole job description";
    return;
  }

  trackEvent("job_input_submitted", { input: "text", surface: "first_run" });
  isSubmitting.value = true;
  const jobId = await startIngestion({ text: input.text });
  isSubmitting.value = false;
  if (!jobId) {
    errorMessage.value = ingestionError.value;
    if (!textMode.value) switchToText(input.text);
    return;
  }
  // The new job page waits for the parse and opens the form with the description filled in
  router.push(`/jobs/new?job=${jobId}`);
}
</script>
