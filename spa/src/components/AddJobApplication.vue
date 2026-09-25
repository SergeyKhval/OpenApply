<template>
  <Dialog :open="isOpen" @update:open="toggleDialog">
    <DialogScrollContent class="sm:max-w-125">
      <DialogHeader>
        <DialogTitle>Add New Job Application</DialogTitle>
        <DialogDescription>
          {{
            viewMode === "link"
              ? "Paste a link to the posting, or the job description itself"
              : viewMode === "paste"
                ? "Paste the job description and we'll pull out the company and role"
                : "Start by creating a new job application"
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="py-2">
        <div v-if="isProcessing" class="flex items-center flex-col">
          <PhSpinner size="64" class="animate-spin" />
          <MessageRotator />
          <Button
            v-if="isParseSlow"
            type="button"
            variant="link"
            class="mt-2"
            @click="abandonParse()"
          >
            Taking too long? Fill in the details yourself
          </Button>
        </div>
        <template v-else>
          <form
            v-if="viewMode === 'link'"
            class="flex flex-col gap-4"
            @submit.prevent="handleSubmit()"
          >
            <Alert v-if="ingestionError" variant="destructive">
              <PhWarningCircle />
              <AlertDescription>
                {{ ingestionError }}
              </AlertDescription>
            </Alert>
            <div class="flex flex-col gap-2">
              <Label for="jobLink">Job link or description</Label>
              <div>
                <Input
                  id="jobLink"
                  v-model="jobLinkInput"
                  type="text"
                  inputmode="url"
                  autocomplete="off"
                  placeholder="https://… or paste the description"
                  :aria-invalid="!!linkInputError"
                  aria-describedby="job-link-error"
                  :class="linkInputError && 'border-destructive'"
                  @paste="onLinkPaste"
                />
                <p
                  v-if="linkInputError"
                  id="job-link-error"
                  role="alert"
                  class="text-destructive text-xs mt-1"
                >
                  {{ linkInputError }}
                </p>
                <p class="mt-1 text-muted-foreground text-sm">
                  LinkedIn or Indeed?
                  <button
                    type="button"
                    class="cursor-pointer font-semibold text-secondary-foreground hover:underline"
                    @click="openPasteView()"
                  >
                    Paste the description instead
                  </button>
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" :disabled="isProcessing">
                <PhSkipForward />
                Continue
              </Button>
              <Button
                type="button"
                variant="outline"
                @click="handleManualEntry()"
              >
                <PhPencilSimple />
                I don't have a link
              </Button>
            </DialogFooter>
          </form>

          <form
            v-else-if="viewMode === 'paste'"
            class="flex flex-col gap-4"
            @submit.prevent="handlePasteSubmit"
          >
            <Alert v-if="ingestionError" variant="destructive">
              <PhWarningCircle />
              <AlertDescription>
                {{ ingestionError }}
              </AlertDescription>
            </Alert>
            <Alert v-else-if="blockedBoard">
              <PhInfo class="text-muted-foreground" />
              <AlertDescription>
                {{ blockedBoardMessage(blockedBoard) }}
              </AlertDescription>
            </Alert>
            <div class="flex flex-col gap-2">
              <Label for="jobDescriptionText">Job description</Label>
              <Textarea
                id="jobDescriptionText"
                ref="descriptionField"
                v-model="pastedDescription"
                :maxlength="MAX_DESCRIPTION_CHARS"
                placeholder="Paste the whole posting: title, company, responsibilities, requirements"
                :aria-invalid="!!pasteError"
                aria-describedby="job-description-error"
                class="min-h-40 max-h-72"
              />
              <p
                v-if="pasteError"
                id="job-description-error"
                role="alert"
                class="text-destructive text-xs"
              >
                {{ pasteError }}
              </p>
              <p v-if="keptLink" class="break-all text-muted-foreground text-sm">
                Link kept: {{ keptLink }}
              </p>
            </div>

            <DialogFooter>
              <Button type="submit" :disabled="isProcessing">
                <PhSkipForward />
                Continue
              </Button>
              <Button type="button" variant="outline" @click="backToLink()">
                <PhLink />
                Use a link instead
              </Button>
            </DialogFooter>
          </form>

          <div v-else class="flex flex-col gap-4">
            <!-- On parse failures the form shows a friendly notice instead of the raw error. -->
            <Alert v-if="ingestionError && !hasParsingFailure" variant="destructive">
              <PhWarningCircle />
              <AlertDescription>
                {{ ingestionError }}
              </AlertDescription>
            </Alert>
            <JobApplicationForm
              :company-name="latestSnapshot?.parsedData?.companyName || ''"
              :position="latestSnapshot?.parsedData?.position || ''"
              :remote-policy="prefilledRemotePolicy"
              :employment-type="prefilledEmploymentType"
              :technologies="latestSnapshot?.parsedData?.technologies || []"
              :company-logo-url="
                latestSnapshot?.parsedData?.companyLogoUrl || ''
              "
              :job-description-link="jobLinkOf(latestSnapshot) || keptLink || ''"
              :job-description="jobDescriptionOf(latestSnapshot)"
              :job-id="latestSnapshot?.id || ''"
              :parsing-failed="hasParsingFailure"
              :parsing-failed-notice="
                isPastedJob(latestSnapshot)
                  ? 'We couldn\'t spot everything in that text. Fill in anything that\'s missing.'
                  : undefined
              "
              :from-paste="isPastedJob(latestSnapshot)"
              @saved="onJobApplicationSaved"
              @back="handleBack"
            />
          </div>
        </template>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import omit from "lodash/omit";
import {
  PhInfo,
  PhLink,
  PhPencilSimple,
  PhSkipForward,
  PhSpinner,
  PhWarningCircle,
} from "@phosphor-icons/vue";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import JobApplicationForm from "@/components/JobApplicationForm.vue";
import MessageRotator from "@/components/MessageRotator.vue";
import {
  isPastedJob,
  jobDescriptionOf,
  jobLinkOf,
  useJobIngestion,
} from "@/composables/useJobIngestion.ts";
import {
  MAX_DESCRIPTION_CHARS,
  blockedBoardMessage,
  blockedJobBoard,
  classifyJobInput,
  looksLikeDescription,
  type BlockedJobBoard,
} from "@/lib/jobInput";
import { trackEvent, type JobInputSurface } from "@/analytics";

type AddJobApplicationProps = { isOpen: boolean };

const { isOpen } = defineProps<AddJobApplicationProps>();

const router = useRouter();
const route = useRoute();

const viewMode = ref<"link" | "paste" | "form">("link");
// The link field also takes a pasted description
const jobLinkInput = ref("");
const linkInputError = ref<string | null>(null);
const pastedDescription = ref("");
const pasteError = ref<string | null>(null);
// A LinkedIn/Indeed link stays on the job while its description is pasted
const keptLink = ref<string | null>(null);
const blockedBoard = ref<BlockedJobBoard | null>(null);
const descriptionField = useTemplateRef<InstanceType<typeof Textarea>>("descriptionField");

const {
  start: startIngestion,
  reset: resetIngestion,
  status: ingestionStatus,
  errorMessage: ingestionError,
  latestSnapshot,
} = useJobIngestion();

// Set when the user gives up on a slow parse, so a late result can't pull
// them out of the manual form.
const isParseAbandoned = ref(false);

const isProcessing = computed(
  () =>
    !isParseAbandoned.value &&
    (ingestionStatus.value === "fetching" || ingestionStatus.value === "waiting"),
);

const hasParsingFailure = computed(
  () =>
    !!latestSnapshot.value &&
    (["parse-failed", "failed"].includes(latestSnapshot.value?.status || "") ||
      !latestSnapshot.value?.parsedData?.companyName ||
      !latestSnapshot.value?.parsedData?.position),
);

const prefilledRemotePolicy = computed<
  "remote" | "in-office" | "hybrid" | undefined
>(() => {
  const value = latestSnapshot.value?.parsedData?.remotePolicy;
  return value === "remote" || value === "in-office" || value === "hybrid"
    ? value
    : undefined;
});

const prefilledEmploymentType = computed<"full-time" | "part-time" | undefined>(
  () => {
    const value = latestSnapshot.value?.parsedData?.employmentType;
    return value === "full-time" || value === "part-time" ? value : undefined;
  },
);

// Parsing has no hard timeout; never leave a new user stuck on a spinner.
const SLOW_PARSE_MS = 15_000;
const isParseSlow = ref(false);
let slowParseTimer: ReturnType<typeof setTimeout> | undefined;

watch(isProcessing, (processing) => {
  clearTimeout(slowParseTimer);
  isParseSlow.value = false;
  if (processing) {
    slowParseTimer = setTimeout(() => (isParseSlow.value = true), SLOW_PARSE_MS);
  }
});

onBeforeUnmount(() => clearTimeout(slowParseTimer));

watch(ingestionStatus, (state) => {
  if (isParseAbandoned.value) return;
  if (state === "ready") {
    viewMode.value = "form";
  }
  // On "error" the view stays put so the alert shows next to what was sent
});

async function handleSubmit(surface: JobInputSurface = "add_dialog") {
  linkInputError.value = null;
  const input = classifyJobInput(jobLinkInput.value);

  if (input.kind === "empty" || input.kind === "too-short") {
    linkInputError.value = "Paste a full link, or the whole job description";
    return;
  }

  if (input.kind === "text") {
    await submitDescription(input.text, surface);
    return;
  }

  const board = blockedJobBoard(input.url);
  if (board) {
    // Don't make them wait on a scrape that is going to fail
    trackEvent("job_board_shortcut_shown", { board, surface });
    openPasteView({ link: input.url, board });
    return;
  }

  trackEvent("job_input_submitted", { input: "link", surface });
  isParseAbandoned.value = false;
  await startIngestion(input.url);
}

async function handlePasteSubmit() {
  pasteError.value = null;
  const input = classifyJobInput(pastedDescription.value);
  if (input.kind !== "text") {
    pasteError.value = input.kind === "link"
      ? "That's a link. Paste the job description itself."
      : "That's too short to be a job description. Paste the whole posting.";
    return;
  }
  await submitDescription(input.text, "add_dialog");
}

async function submitDescription(text: string, surface: JobInputSurface) {
  trackEvent("job_input_submitted", {
    input: "text",
    surface,
    ...(blockedBoard.value ? { board: blockedBoard.value } : {}),
  });
  pastedDescription.value = text;
  viewMode.value = "paste";
  isParseAbandoned.value = false;
  await startIngestion(keptLink.value ? { text, url: keptLink.value } : { text });
}

function onLinkPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData("text") ?? "";
  if (!looksLikeDescription(pasted)) return;
  // A one-line input would flatten the description; move it to the text box
  event.preventDefault();
  openPasteView({ text: pasted.trim() });
}

async function openPasteView(
  { link = null, board = null, text = "" }: { link?: string | null; board?: BlockedJobBoard | null; text?: string } = {},
) {
  resetIngestion();
  keptLink.value = link;
  blockedBoard.value = board;
  pastedDescription.value = text;
  pasteError.value = null;
  viewMode.value = "paste";
  await nextTick();
  (descriptionField.value?.$el as HTMLTextAreaElement | undefined)?.focus();
}

function backToLink() {
  resetIngestion();
  keptLink.value = null;
  blockedBoard.value = null;
  pasteError.value = null;
  viewMode.value = "link";
}

function abandonParse() {
  isParseAbandoned.value = true;
  handleManualEntry();
}

function handleManualEntry() {
  resetIngestion();
  viewMode.value = "form";
}

async function onJobApplicationSaved(id: string) {
  toggleDialog(false);
  resetForm();
  await router.push(`/jobs/${id}?created=1`);
}

function handleBack() {
  // Back from the form returns to wherever the job came from
  viewMode.value = isPastedJob(latestSnapshot.value) ? "paste" : "link";
  resetIngestion();
}

function resetForm() {
  isParseAbandoned.value = false;
  viewMode.value = "link";
  jobLinkInput.value = "";
  linkInputError.value = null;
  pastedDescription.value = "";
  pasteError.value = null;
  keptLink.value = null;
  blockedBoard.value = null;
  resetIngestion();
}

watch(
  () => isOpen,
  (newValue) => {
    if (!newValue) {
      setTimeout(() => {
        resetForm();
      }, 200);
    }
  },
);

// Entry points like the first-run prompt open the dialog with the link
// already provided (?job-link=) or straight in manual mode (?add-mode=manual).
watch(
  () => [isOpen, route.query["job-link"], route.query["add-mode"]] as const,
  async ([open, prefilledLink, addMode]) => {
    if (!open) return;

    if (typeof prefilledLink === "string" && prefilledLink) {
      await router.replace({ query: omit(route.query, "job-link") });
      jobLinkInput.value = prefilledLink;
      await handleSubmit("first_run");
    } else if (addMode === "manual") {
      await router.replace({ query: omit(route.query, "add-mode") });
      handleManualEntry();
    }
  },
  { immediate: true },
);

function toggleDialog(isOpen: boolean) {
  if (!isOpen) {
    router.replace({
      query: omit(route.query, "dialog-name", "job-link", "add-mode"),
    });
  }
}
</script>
