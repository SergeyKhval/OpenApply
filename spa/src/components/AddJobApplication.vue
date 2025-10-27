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
            <Alert v-if="ingestionError" variant="destructive">
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
import { computed, ref, watch } from "vue";
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

const emit = defineEmits<{ (event: "saved", id: string): void }>();

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

const isProcessing = computed(
  () =>
    ingestionStatus.value === "fetching" || ingestionStatus.value === "waiting",
);

const hasParsingFailure = computed(
  () =>
    latestSnapshot.value?.status === "parse-failed" ||
    latestSnapshot.value?.status === "failed",
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

watch(ingestionStatus, (state) => {
  if (state === "ready") {
    viewMode.value = "form";
  } else if (state === "error") {
    viewMode.value = "link";
  }
});

const handleSubmit = async () => {
  v$.value.$touch();
  if (v$.value.$invalid) return;

  await startIngestion(jobDescriptionLink.value);
};

function handleManualEntry() {
  resetIngestion();
  viewMode.value = "form";
}

function onJobApplicationSaved(id: string) {
  toggleDialog(false);
  resetForm();
  emit("saved", id);
}

function handleBack() {
  viewMode.value = "link";
  resetIngestion();
}

function resetForm() {
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

function toggleDialog(isOpen: boolean) {
  if (!isOpen) {
    router.replace({ query: omit(route.query, "dialog-name") });
  }
}
</script>
