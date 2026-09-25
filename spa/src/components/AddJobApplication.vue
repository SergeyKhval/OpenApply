<template>
  <Dialog :open="isOpen" @update:open="toggleDialog">
    <DialogScrollContent class="sm:max-w-125">
      <DialogHeader>
        <DialogTitle>Add New Job Application</DialogTitle>
        <DialogDescription>
          {{
            viewMode === "link"
              ? "Start by adding a link to the job description page"
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
            @submit.prevent="handleSubmit"
          >
            <Alert v-if="ingestionError" variant="destructive">
              <PhWarningCircle />
              <AlertDescription>
                {{ ingestionError }}
              </AlertDescription>
            </Alert>
            <div class="flex flex-col gap-2">
              <Label for="jobLink">Job Description Link</Label>
              <div>
                <Input
                  id="jobLink"
                  v-model="jobDescriptionLink"
                  type="url"
                  placeholder="https://..."
                  :class="
                    v$.jobDescriptionLink.$dirty &&
                    v$.jobDescriptionLink.$invalid &&
                    'border-destructive'
                  "
                />
                <p
                  v-if="
                    v$.jobDescriptionLink.$dirty &&
                    v$.jobDescriptionLink.$invalid
                  "
                  class="text-destructive text-xs mt-1"
                >
                  Provide a valid URL
                </p>
                <p class="mt-1 text-muted-foreground text-sm">
                  We never share your jobs with 3rd parties
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
              :job-description-link="
                latestSnapshot?.jobDescriptionLink || jobDescriptionLink || ''
              "
              :job-description="latestSnapshot?.parsedData?.description || ''"
              :job-id="latestSnapshot?.id || ''"
              :parsing-failed="hasParsingFailure"
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
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import omit from "lodash/omit";
import {
  PhPencilSimple,
  PhSkipForward,
  PhSpinner,
  PhWarningCircle,
} from "@phosphor-icons/vue";
import { useVuelidate } from "@vuelidate/core";
import { required, url } from "@vuelidate/validators";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import JobApplicationForm from "@/components/JobApplicationForm.vue";
import MessageRotator from "@/components/MessageRotator.vue";
import { useJobIngestion } from "@/composables/useJobIngestion.ts";

type AddJobApplicationProps = { isOpen: boolean };

const { isOpen } = defineProps<AddJobApplicationProps>();

const router = useRouter();
const route = useRoute();

const viewMode = ref<"link" | "form">("link");
const jobDescriptionLink = ref("");

const {
  start: startIngestion,
  reset: resetIngestion,
  status: ingestionStatus,
  errorMessage: ingestionError,
  latestSnapshot,
} = useJobIngestion();

const v$ = useVuelidate(
  {
    jobDescriptionLink: { required, url },
  },
  { jobDescriptionLink },
);

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
  } else if (state === "error") {
    viewMode.value = "link";
  }
});

const handleSubmit = async () => {
  v$.value.$touch();
  if (v$.value.$invalid) return;

  isParseAbandoned.value = false;
  await startIngestion(jobDescriptionLink.value);
};

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
  viewMode.value = "link";
  resetIngestion();
}

function resetForm() {
  isParseAbandoned.value = false;
  viewMode.value = "link";
  jobDescriptionLink.value = "";
  v$.value.$reset();
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
      jobDescriptionLink.value = prefilledLink;
      await handleSubmit();
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
