<template>
  <Dialog :open="isOpen" @update:open="toggleDialog">
    <DialogScrollContent class="sm:max-w-125">
      <DialogHeader>
        <DialogTitle>AI Review</DialogTitle>
        <DialogDescription>
          Explore how your resume matches with a particular job description
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <ResumeSelect v-model="selectedResumeId" />
        <JobApplicationSelect v-model="selectedJobApplicationId" />
        <Alert
          v-if="
            selectedJobApplicationId && !selectedJobApplication?.jobDescription
          "
        >
          <PhWarningCircle class="text-destructive!" />
          <AlertDescription>
            <p>
              Selected job application must have a description for the AI review
              to work. Add job description on the
              <RouterLink
                :to="`/dashboard/applications/${selectedJobApplicationId}`"
                class="text-primary hover:underline"
                >job application details page</RouterLink
              >.
            </p>
            <p>You will be able to score your resume from that page as well</p>
          </AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          :disabled="
            !selectedJobApplicationId ||
            !selectedResumeId ||
            !selectedJobApplication?.jobDescription
          "
          @click="reviewResume()"
        >
          <PhScales />
          Review
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { httpsCallable } from "firebase/functions";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from "@/components/ui/dialog";
import omit from "lodash/omit";
import { useRoute, useRouter } from "vue-router";
import ResumeSelect from "@/components/inputs/ResumeSelect.vue";
import JobApplicationSelect from "@/components/inputs/JobApplicationSelect.vue";
import { Button } from "@/components/ui/button";
import { PhScales, PhWarningCircle } from "@phosphor-icons/vue";
import { functions } from "@/firebase/config.ts";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData.ts";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ScoreResumeDialogProps = { isOpen: boolean };

const { isOpen } = defineProps<ScoreResumeDialogProps>();

const router = useRouter();
const route = useRoute();

const { jobApplications } = useJobApplicationsData();

const selectedResumeId = ref("");
const selectedJobApplicationId = ref("");
const selectedJobApplication = computed(() =>
  jobApplications.value.find((ja) => ja.id === selectedJobApplicationId.value),
);

const matchResumeWithJobApplication = httpsCallable(
  functions,
  "matchResumeWithJobApplication",
);

function toggleDialog(isOpen: boolean) {
  if (!isOpen) {
    router.replace({ query: omit(route.query, "dialog-name") });
  }
}

async function reviewResume() {
  const result = await matchResumeWithJobApplication({
    resumeId: selectedResumeId.value,
    jobApplicationId: selectedJobApplicationId.value,
  });

  console.log(result);
}
</script>
