<template>
  <div>
    <PageHeader>
      <h2
        class="text-2xl font-semibold whitespace-nowrap capitalize flex items-center gap-2 grow"
      >
        <RouterLink
          to="/jobs"
          class="lg:text-muted-foreground hover:underline hover:text-foreground"
          >Applications</RouterLink
        >
        <PhCaretRight
          class="hidden lg:inline text-muted-foreground"
          :size="20"
        />
        <span v-if="application" class="hidden lg:inline">
          <a
            v-if="application.jobDescriptionLink"
            :href="application.jobDescriptionLink"
            class="text-primary inline-flex items-center gap-1 hover:underline text-base lg:text-2xl"
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {{ application.companyName }} - {{ application.position }}
            <PhArrowSquareOut />
          </a>
          <template v-else>
            {{ application.companyName }} - {{ application.position }}
          </template>
        </span>
      </h2>
      <AddJobApplicationDropdown />
    </PageHeader>

    <div class="px-6 flex flex-col gap-6 pb-6">
      <div v-if="application" class="flex flex-col gap-4">
        <div class="lg:hidden mb-3 flex flex-col">
          <span class="text-lg text-muted-foreground">
            {{ application.companyName }}
          </span>
          <a
            v-if="application.jobDescriptionLink"
            :href="application.jobDescriptionLink"
            class="text-primary inline-flex items-center gap-1 hover:underline text-2xl"
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {{ application.position }}
            <PhArrowSquareOut />
          </a>
          <span v-else class="text-2xl">
            {{ application.position }}
          </span>
        </div>
        <h3
          v-if="application.status === 'archived'"
          class="text-2xl flex items-center gap-2"
        >
          This application is archived
          <Button
            variant="outline"
            size="sm"
            @click="restoreJobApplication(application)"
          >
            <PhClockClockwise />
            Restore?
          </Button>
        </h3>
        <div v-else class="mb-3">
          <!-- Mobile: a real dropdown instead of a wrapping row of tiny text links -->
          <Select
            :model-value="application.status"
            @update:model-value="(value) => updateJobApplicationStatus(value as JobStatus)"
          >
            <SelectTrigger class="sm:hidden w-full max-w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="status in statusBar" :key="status.status" :value="status.status">
                {{ status.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Desktop/tablet: segmented control -->
          <div class="hidden sm:inline-flex rounded-md border border-border overflow-hidden">
            <Tooltip v-for="(status, index) in statusBar" :key="status.name">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="px-3 py-1.5 text-sm whitespace-nowrap cursor-pointer transition-colors inline-flex items-center gap-1"
                  :class="[
                    index > 0 && 'border-l border-border',
                    status.status === application.status
                      ? 'bg-primary text-primary-foreground font-medium'
                      : status.isActive
                        ? 'text-foreground hover:bg-muted'
                        : 'text-muted-foreground hover:bg-muted',
                  ]"
                  @click="updateJobApplicationStatus(status.status)"
                >
                  {{ status.name }}
                  <span
                    v-if="application.status === 'hired' && status.status === 'hired'"
                    class="inline-flex items-center"
                  >
                    <PhFire size="14" class="text-stage-interviewing" />
                    <PhHandsClapping size="14" />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent :side-offset="-5">
                <span>Update status to {{ status.name }}</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div
          v-if="application.technologies && application.technologies.length > 0"
          class="flex flex-wrap gap-1"
        >
          <Badge
            v-for="tech in application.technologies"
            :key="tech"
            variant="outline"
            class="text-sm"
          >
            {{ tech }}
          </Badge>
        </div>
      </div>

      <Alert v-if="showJustCreatedPrompt" class="flex items-center justify-between">
        <PhCheckCircle class="size-4 text-success" />
        <AlertDescription class="flex items-center gap-3 flex-wrap">
          <span>Saved to your tracker. Have you applied yet?</span>
          <div class="flex gap-2 shrink-0">
            <Button size="sm" @click="markCreatedApplied">
              <PhCheck />
              I've applied
            </Button>
            <Button size="sm" variant="outline" @click="dismissJustCreatedPrompt">
              Not yet
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Alert
        v-if="resumes.length === 0 && !isResumeBannerDismissed && !application?.toolMatch"
        class="flex flex-col sm:flex-row sm:items-center justify-between"
      >
        <PhUploadSimple class="size-4" />
        <AlertDescription class="flex flex-col sm:flex-row sm:items-center gap-3">
          <span
            ><strong>See how you stack up.</strong> Upload a resume to get an AI
            match score and tailored fixes for this role.</span
          >
          <Button size="sm" class="shrink-0 whitespace-nowrap" :disabled="isUploading" @click="openFileDialog()">
            {{ isUploading ? 'Uploading…' : 'Upload Resume →' }}
          </Button>
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          class="size-7 shrink-0 self-end sm:self-auto"
          aria-label="Dismiss"
          @click="dismissResumeBanner"
        >
          <PhX class="size-4" />
        </Button>
      </Alert>

      <ToolMatchCard
        v-if="application?.toolMatch"
        :match="application.toolMatch"
        :just-saved="route.query.from === 'tool'"
        @mark-applied="updateJobApplicationStatus('applied')"
      />

      <div v-if="application" class="grid lg:grid-cols-2 gap-4">
        <div class="flex flex-col gap-4">
          <JobApplicationAttachments :application="application" />

          <JobApplicationInterviews :application-id="applicationId" />

          <JobApplicationNotes :application-id="applicationId" />
        </div>

        <div class="flex flex-col gap-4">
          <JobApplicationDescription
            v-if="application"
            :application="application"
          />

          <JobApplicationContacts :application-id="applicationId" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useDocument } from "vuefire";
import {
  collection,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  PhArrowSquareOut,
  PhCaretRight,
  PhCheck,
  PhCheckCircle,
  PhClockClockwise,
  PhFire,
  PhHandsClapping,
  PhUploadSimple,
  PhX,
} from "@phosphor-icons/vue";
import { JobApplication, JobStatus } from "@/types";
import { db } from "@/firebase/config.ts";
import PageHeader from "@/components/PageHeader.vue";
import JobApplicationNotes from "@/components/JobApplicationNotes.vue";
import JobApplicationContacts from "@/components/JobApplicationContacts.vue";
import JobApplicationInterviews from "@/components/JobApplicationInterviews.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResumes } from "@/composables/useResumes";
import { useResumeUpload } from "@/composables/useResumeUpload";
import { restoreJobApplication } from "@/firebase/restoreJobApplication.ts";
import { getLocalTimeZone, today } from "@internationalized/date";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AddJobApplicationDropdown from "@/components/AddJobApplicationDropdown.vue";
import JobApplicationAttachments from "@/components/JobApplicationAttachments.vue";
import JobApplicationDescription from "@/components/JobApplicationDescription.vue";
import ToolMatchCard from "@/components/ToolMatchCard.vue";

type ApplicationPageProps = {
  jobId: string;
};

const { jobId: applicationId } = defineProps<ApplicationPageProps>();
const route = useRoute();

const { data: application } = useDocument<JobApplication>(
  doc(collection(db, "jobApplications"), applicationId),
);

const { data: resumes } = useResumes();
const { openFileDialog, isUploading } = useResumeUpload();
const isResumeBannerDismissed = ref(
  localStorage.getItem("dismiss-resume-banner") === "true",
);

function dismissResumeBanner() {
  isResumeBannerDismissed.value = true;
  localStorage.setItem("dismiss-resume-banner", "true");
}

// Shown once right after a manual/link-parse save (?created=1); the tool
// handoff has its own success moment on ToolMatchCard instead.
const justCreatedDismissed = ref(false);
const showJustCreatedPrompt = computed(
  () =>
    route.query.created === "1" &&
    !justCreatedDismissed.value &&
    !application.value?.toolMatch,
);

function dismissJustCreatedPrompt() {
  justCreatedDismissed.value = true;
}

async function markCreatedApplied() {
  await updateJobApplicationStatus("applied");
  justCreatedDismissed.value = true;
}

const statusBar = computed(() => {
  if (!application.value) return [];
  const statuses: JobStatus[] = [
    "draft",
    "applied",
    "interviewing",
    "offered",
    "hired",
  ];
  const activeStatusIndex = statuses.indexOf(application.value.status);
  return statuses.map((status, index) => ({
    status,
    name: {
      draft: "Draft",
      applied: "Applied",
      interviewing: "Interviewing",
      offered: "Job Offer",
      hired: "Hired",
      rejected: "",
      archived: "",
    }[status],
    isActive: index <= activeStatusIndex,
    isCaretActive: index < activeStatusIndex,
  }));
});

async function updateJobApplicationStatus(status: JobStatus) {
  if (!application.value) return;

  const timezone = getLocalTimeZone();
  const currentDate = today(timezone).toDate(timezone);
  const updates: Record<string, any> = {
    status,
    updatedAt: serverTimestamp(),
  };

  // Set the corresponding timestamp field based on the new status
  // Using Date objects that will be stored as Timestamps in Firestore
  switch (status) {
    case "applied":
      // If moving back to applied, keep the original appliedAt or set it now
      if (!application.value.appliedAt) {
        updates.appliedAt = currentDate;
      }
      // Clear future status timestamps when moving back
      updates.interviewedAt = null;
      updates.offeredAt = null;
      updates.hiredAt = null;
      break;
    case "interviewing":
      updates.interviewedAt = currentDate;
      // Clear future status timestamps
      updates.offeredAt = null;
      updates.hiredAt = null;
      break;
    case "offered":
      updates.offeredAt = currentDate;
      // Clear future status timestamps
      updates.hiredAt = null;
      break;
    case "hired":
      updates.hiredAt = currentDate;
      break;
  }

  await updateDoc(doc(db, "jobApplications", application.value?.id), updates);
}
</script>

<route lang="yaml">
props: true
meta:
  requiresAuth: true
</route>
