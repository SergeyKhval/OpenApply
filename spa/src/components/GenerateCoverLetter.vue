<template>
  <AiSheet :open="isOpen" title="Cover letter" :eyebrow="eyebrow" @update:open="updateDialogOpenState">
    <AiLimitReached v-if="allowance && !canUseAi" :allowance="allowance" source="cover_letter" />

    <div v-else-if="isProcessing" class="flex flex-col items-center gap-4 py-10 text-center" role="status">
      <Spinner class="size-10" />
      <p class="text-[15px] text-soft-foreground">Writing your cover letter. This takes 20 to 30 seconds.</p>
    </div>

    <Empty v-else-if="!hasResumes">
      <EmptyIcon><PhFile :size="32" /></EmptyIcon>
      <div class="space-y-2">
        <EmptyTitle>Upload a resume</EmptyTitle>
        <EmptyDescription>The letter is written from your resume and the job, so it needs a resume first.</EmptyDescription>
      </div>
      <EmptyAction><UploadResumeButton>Upload resume</UploadResumeButton></EmptyAction>
    </Empty>

    <Empty v-else-if="!hasJobApplications">
      <EmptyIcon><PhSuitcase :size="32" /></EmptyIcon>
      <div class="space-y-2">
        <EmptyTitle>Add a job</EmptyTitle>
        <EmptyDescription>A cover letter is written for one job. Add the job first.</EmptyDescription>
      </div>
      <EmptyAction>
        <Button @click="$router.replace({ query: { ...$route.query, 'dialog-name': 'add-job-application' } })">Add job</Button>
      </EmptyAction>
    </Empty>

    <template v-else>
      <div class="flex flex-col gap-4">
        <ResumeSelect v-model="selectedResumeId" />
        <JobApplicationSelect v-if="!fixedJob" v-model="selectedJobApplicationId" />
      </div>

      <Alert v-if="selectedJobApplicationId && !selectedJobApplication?.jobDescription">
        <PhWarningCircle class="text-destructive!" />
        <AlertDescription>
          This job has no description, so the letter can only use the company and role. Add the description on
          <RouterLink :to="`/jobs/${selectedJobApplicationId}`" class="font-medium text-secondary-foreground hover:underline">the job page</RouterLink>
          for a letter that talks about the actual job.
        </AlertDescription>
      </Alert>

      <div class="flex flex-col gap-3">
        <ChoicePills v-model="length" label="Length" :options="LENGTH_OPTIONS" />
        <ChoicePills v-model="tone" label="Tone" :options="TONE_OPTIONS" />
      </div>

      <Alert v-if="errorMessage" variant="destructive">
        <PhWarningCircle />
        <AlertDescription>{{ errorMessage }}</AlertDescription>
      </Alert>
    </template>

    <template v-if="canUseAi && !isProcessing && hasResumes && hasJobApplications" #footer>
      <AiChecksLeft v-if="allowance" :allowance="allowance" />
      <div class="flex flex-col gap-2 sm:flex-row">
        <Button :disabled="!canSubmit" @click="handleGenerateCoverLetter">
          <PhSparkle />
          Write it · 1 check
        </Button>
        <Button variant="ghost" @click="updateDialogOpenState(false)">Cancel</Button>
      </div>
    </template>
  </AiSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { PhFile, PhSparkle, PhSuitcase, PhWarningCircle } from "@phosphor-icons/vue";
import { omit } from "lodash";
import { useRoute, useRouter } from "vue-router";
import AiChecksLeft from "@/components/AiChecksLeft.vue";
import AiLimitReached from "@/components/AiLimitReached.vue";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
import AiSheet from "@/components/ai/AiSheet.vue";
import ChoicePills from "@/components/ai/ChoicePills.vue";
import JobApplicationSelect from "@/components/inputs/JobApplicationSelect.vue";
import ResumeSelect from "@/components/inputs/ResumeSelect.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyAction, EmptyDescription, EmptyIcon, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useCoverLetters, type CoverLetterStyle } from "@/composables/useCoverLetters";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { useResumes } from "@/composables/useResumes";
import { LENGTH_OPTIONS, TONE_OPTIONS } from "@/components/ai/coverLetterOptions";

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
// Opened from a job (its page or a match): the job is fixed, no picker
const fixedJob = computed(() => typeof route.query["application-id"] === "string");
const length = ref<CoverLetterStyle["length"]>("standard");
const tone = ref<CoverLetterStyle["tone"]>("plain");
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

const eyebrow = computed(() =>
  fixedJob.value && selectedJobApplication.value
    ? `${selectedJobApplication.value.companyName} · ${selectedJobApplication.value.position}`
    : undefined,
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
  if (newResumes && newResumes.length && isOpen && !selectedResumeId.value) {
    selectedResumeId.value = newResumes[0].id;
  }
});

const { allowance, canUseAi } = useAiAllowance();

const hasJobApplications = computed(
  () => (jobApplications.value?.length ?? 0) > 0,
);
const hasResumes = computed(() => (resumes.value?.length ?? 0) > 0);

const canGenerate = computed(() =>
  Boolean(selectedJobApplicationId.value && selectedResumeId.value),
);

const canSubmit = computed(
  () => canGenerate.value && canUseAi.value,
);

const handleGenerateCoverLetter = async () => {
  if (!canGenerate.value) return;

  isProcessing.value = true;
  errorMessage.value = "";

  const result = await generateCoverLetter(
    selectedJobApplicationId.value,
    selectedResumeId.value,
    { length: length.value, tone: tone.value },
  );

  isProcessing.value = false;

  if (result.success && result.data) {
    // Show the letter right away, in the preview sheet
    await router.replace({
      query: {
        ...omit(route.query, ["application-id", "resume-id"]),
        "dialog-name": "cover-letter-preview",
        "cover-letter-id": result.data.coverLetterId,
      },
    });
  } else if (!result.success) {
    errorMessage.value = result.error || "Failed to generate cover letter";
  }
};

const resetForm = () => {
  selectedJobApplicationId.value = "";
  selectedResumeId.value = "";
  errorMessage.value = "";
  pendingJobApplicationId.value = null;
  length.value = "standard";
  tone.value = "plain";
};

async function updateDialogOpenState(open: boolean) {
  if (!open) {
    await router.replace({
      query: omit(route.query, ["dialog-name", "application-id", "resume-id"]),
    });
  }
}
</script>
