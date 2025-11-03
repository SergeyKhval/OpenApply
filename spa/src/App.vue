<template>
  <TooltipProvider>
    <RouterView />
  </TooltipProvider>
  <Toaster />

  <SuccessCheckoutDialog :is-open="isStripeSuccessCheckoutDialogOpen" />
  <FailureCheckoutDialog :is-open="isStripeFailureCheckoutDialogOpen" />
  <GenerateCoverLetter :is-open="isGenerateCoverLetterDialogOpen" />
  <CoverLetterPreview :is-open="isCoverLetterPreviewDialogOpen" />
  <ResumePickerDialog :is-open="isResumePickerDialogOpen" />
  <AddJobApplication :is-open="isAddJobApplicationDialogOpen" />
  <ScoreResumeDialog :is-open="isScoreResumeDialogOpen" />
</template>
<script setup lang="ts">
import { computed } from "vue";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { useRoute } from "vue-router";
import SuccessCheckoutDialog from "@/components/SuccessCheckoutDialog.vue";
import FailureCheckoutDialog from "@/components/FailureCheckoutDialog.vue";
import GenerateCoverLetter from "@/components/GenerateCoverLetter.vue";
import ResumePickerDialog from "@/components/ResumePickerDialog.vue";
import CoverLetterPreview from "@/components/CoverLetterPreview.vue";
import AddJobApplication from "@/components/AddJobApplication.vue";
import ScoreResumeDialog from "@/components/ScoreResumeDialog.vue";

const route = useRoute();

const isStripeSuccessCheckoutDialogOpen = computed(
  () => route.query["dialog-name"] === "checkout-success",
);
const isStripeFailureCheckoutDialogOpen = computed(
  () => route.query["dialog-name"] === "checkout-canceled",
);
const isGenerateCoverLetterDialogOpen = computed(
  () => route.query["dialog-name"] === "generate-cover-letter",
);
const isCoverLetterPreviewDialogOpen = computed(
  () => route.query["dialog-name"] === "cover-letter-preview",
);
const isResumePickerDialogOpen = computed(
  () => route.query["dialog-name"] === "resume-picker",
);

const isAddJobApplicationDialogOpen = computed(
  () => route.query["dialog-name"] === "add-job-application",
);

const isScoreResumeDialogOpen = computed(
  () => route.query["dialog-name"] === "score-resume",
);
</script>
