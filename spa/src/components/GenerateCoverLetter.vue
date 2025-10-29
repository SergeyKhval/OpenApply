<template>
  <Dialog :open="isOpen" @update:open="updateDialogOpenState">
    <DialogScrollContent class="sm:max-w-200">
      <DialogHeader>
        <DialogTitle>Generate Cover Letter</DialogTitle>
        <DialogDescription>
          Select a job application and resume to generate a tailored cover
          letter
        </DialogDescription>
      </DialogHeader>

      <div class="py-4 space-y-4">
        <div
          class="rounded-lg border border-dashed border-border p-4 bg-muted/20 flex items-center justify-between"
        >
          <div>
            <p class="text-sm font-medium text-muted-foreground">
              Available coins
            </p>
            <p class="text-2xl font-semibold flex items-center gap-1">
              <PhCoins />{{ currentBalance }}
            </p>
            <span class="text-xs text-muted-foreground text-right">
              10 coins per cover letter
            </span>
          </div>
        </div>

        <div v-if="!hasSufficientCredits" class="space-y-6">
          <div
            class="rounded-lg border border-border bg-muted/10 p-6 space-y-2"
          >
            <p class="text-lg font-semibold">Add more coins to continue</p>
            <p class="text-sm text-muted-foreground">
              You need at least {{ requiredCredits }} coins to generate a cover
              letter. Choose a pack below to keep going.
            </p>
          </div>
          <CreditPackOptions
            :loading="generatingStripeLink"
            @purchase="startCheckout"
          />
        </div>

        <!-- Loading State -->
        <div v-if="isProcessing" class="flex items-center flex-col py-8">
          <PhSpinner size="64" class="animate-spin" />
          <p class="mt-4 text-muted-foreground text-center">
            Generating your cover letter...
            <br />
            This may take 20-30 seconds. Hold tight!
          </p>
        </div>

        <div v-else-if="hasSufficientCredits" class="space-y-6">
          <Empty v-if="!hasResumes">
            <EmptyIcon>
              <PhFile :size="32" />
            </EmptyIcon>
            <div class="space-y-2">
              <EmptyTitle>Upload a resume</EmptyTitle>
              <EmptyDescription>
                Add a resume so we can tailor your cover letter to your
                experience.
              </EmptyDescription>
            </div>
            <EmptyAction>
              <UploadResumeButton size="lg" @uploaded="handleResumeUploaded">
                Upload Resume
              </UploadResumeButton>
            </EmptyAction>
          </Empty>

          <Empty v-else-if="!hasJobApplications">
            <EmptyIcon>
              <PhSuitcase :size="32" />
            </EmptyIcon>
            <div class="space-y-2">
              <EmptyTitle>Add a job application</EmptyTitle>
              <EmptyDescription>
                Create an application to personalize your cover letter for the
                role.
              </EmptyDescription>
            </div>
            <EmptyAction>
              <Button
                @click="
                  $router.replace({
                    query: {
                      ...$route.query,
                      'dialog-name': 'add-job-application',
                    },
                  })
                "
              >
                Add job application</Button
              >
            </EmptyAction>
          </Empty>

          <div v-else class="space-y-6">
            <ResumeSelect v-model="selectedResumeId" />

            <JobApplicationSelect v-model="selectedJobApplicationId" />

            <Alert
              v-if="
                selectedJobApplicationId &&
                !selectedJobApplication?.jobDescription
              "
            >
              <PhWarningCircle class="text-destructive!" />
              <AlertDescription>
                <p>
                  Selected job application does not have a job description.
                  Cover letter quality may be impacted. You can add a job
                  description on the
                  <RouterLink
                    :to="`/dashboard/applications/${selectedJobApplicationId}`"
                    class="text-primary hover:underline"
                  >
                    job application details page </RouterLink
                  >.
                </p>
                <p>
                  You will be able to generate cover letter from that page as
                  well
                </p>
              </AlertDescription>
            </Alert>

            <!-- Error Message -->
            <Alert v-if="errorMessage" variant="destructive">
              <PhWarningCircle />
              <AlertDescription>
                {{ errorMessage }}
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button :disabled="!canSubmit" @click="handleGenerateCoverLetter">
                <PhSparkle />
                Generate
              </Button>
              <Button variant="outline" @click="updateDialogOpenState(false)">
                Cancel
              </Button>
            </DialogFooter>
          </div>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  PhCoins,
  PhFile,
  PhSparkle,
  PhSpinner,
  PhSuitcase,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
import { useCoverLetters } from "@/composables/useCoverLetters";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { useResumes } from "@/composables/useResumes";
import {
  Empty,
  EmptyAction,
  EmptyDescription,
  EmptyIcon,
  EmptyTitle,
} from "@/components/ui/empty";
import { useAuth } from "@/composables/useAuth";
import { useCreditsCheckout } from "@/composables/useCreditsCheckout";
import CreditPackOptions from "@/components/CreditPackOptions.vue";
import { omit } from "lodash";
import { useRoute, useRouter } from "vue-router";
import ResumeSelect from "@/components/inputs/ResumeSelect.vue";
import JobApplicationSelect from "@/components/inputs/JobApplicationSelect.vue";

type GenerateCoverLetterProps = {
  isOpen: boolean;
};

const { isOpen } = defineProps<GenerateCoverLetterProps>();
watch(
  () => isOpen,
  (newValue) => {
    if (!newValue) resetForm();
  },
);

const router = useRouter();
const route = useRoute();

const selectedJobApplicationId = ref("");
watch(
  () => route.query["application-id"],
  (newApplicationId) => {
    if (
      newApplicationId &&
      newApplicationId !== selectedJobApplicationId.value
    ) {
      selectedJobApplicationId.value = newApplicationId as string;
    }
  },
  { immediate: true },
);

const selectedJobApplication = computed(() => {
  if (!selectedJobApplicationId.value || !jobApplications.value) return null;
  return (
    jobApplications.value.find(
      (app) => app.id === selectedJobApplicationId.value,
    ) || null
  );
});
// Pre-select resume if job application has one linked
watch(selectedJobApplication, (newApp) => {
  if (newApp?.resumeId && resumes.value) {
    const linkedResume = resumes.value.find((r) => r.id === newApp.resumeId);
    if (linkedResume) {
      selectedResumeId.value = linkedResume.id;
    }
  }
});

const selectedResumeId = ref("");
watch(
  () => route.query["resume-id"],
  (newResumeId) => {
    if (newResumeId && newResumeId !== selectedResumeId.value) {
      selectedResumeId.value = newResumeId as string;
    }
  },
  { immediate: true },
);
const isProcessing = ref(false);
const errorMessage = ref("");
const pendingResumeId = ref<string | null>(null);
const pendingJobApplicationId = ref<string | null>(null);

const { generateCoverLetter } = useCoverLetters();

const { jobApplications } = useJobApplicationsData();
watch(jobApplications, (newApplications) => {
  if (pendingJobApplicationId.value && newApplications) {
    const createdApplication = newApplications.find(
      (app) => app.id === pendingJobApplicationId.value,
    );

    if (createdApplication) {
      selectedJobApplicationId.value = createdApplication.id;
      pendingJobApplicationId.value = null;
    }
  } else if (newApplications && newApplications.length) {
    if (isOpen && !selectedJobApplicationId.value) {
      selectedJobApplicationId.value = newApplications[0].id;
    }
  } else if (newApplications && newApplications.length === 0) {
    selectedJobApplicationId.value = "";
  }
});

const resumesCollection = useResumes();
const resumes = computed(() =>
  resumesCollection.value.filter((r) => r.status === "parsed"),
);
watch(resumes, (newResumes) => {
  if (pendingResumeId.value && newResumes) {
    const createdResume = newResumes.find(
      (resume) => resume.id === pendingResumeId.value,
    );

    if (createdResume) {
      selectedResumeId.value = createdResume.id;
      pendingResumeId.value = null;
    }
  } else if (newResumes && newResumes.length) {
    if (isOpen && !selectedResumeId.value) {
      selectedResumeId.value = newResumes[0].id;
    }
  } else if (newResumes && newResumes.length === 0) {
    selectedResumeId.value = "";
  }
});

const { userProfile } = useAuth();
const { startCheckout, isProcessing: generatingStripeLink } =
  useCreditsCheckout();

const requiredCredits = 10;

const hasJobApplications = computed(
  () => (jobApplications.value?.length ?? 0) > 0,
);
const hasResumes = computed(() => (resumes.value?.length ?? 0) > 0);
const currentBalance = computed(
  () => userProfile.value?.billingProfile?.currentBalance ?? 0,
);
const hasSufficientCredits = computed(
  () => currentBalance.value >= requiredCredits,
);

const canGenerate = computed(() =>
  Boolean(selectedJobApplicationId.value && selectedResumeId.value),
);

const canSubmit = computed(
  () => canGenerate.value && hasSufficientCredits.value,
);

const handleResumeUploaded = (resumeId: string) => {
  if (!resumeId) return;
  pendingResumeId.value = resumeId;
};

const handleGenerateCoverLetter = async () => {
  if (!canGenerate.value) return;

  isProcessing.value = true;
  errorMessage.value = "";

  const result = await generateCoverLetter(
    selectedJobApplicationId.value,
    selectedResumeId.value,
  );

  isProcessing.value = false;

  if (result.success) {
    await updateDialogOpenState(false);
  } else {
    if (result.code !== "insufficient-credits") {
      errorMessage.value = result.error || "Failed to generate cover letter";
    }
  }
};

const resetForm = () => {
  selectedJobApplicationId.value = "";
  selectedResumeId.value = "";
  errorMessage.value = "";
  pendingResumeId.value = null;
  pendingJobApplicationId.value = null;
};

async function updateDialogOpenState(open: boolean) {
  if (!open) {
    await router.replace({
      query: omit(route.query, ["dialog-name", "application-id", "resume-id"]),
    });
  }
}
</script>
