<template>
  <div>
    <PageHeader>
      <nav aria-label="Breadcrumb" class="flex min-w-0 grow items-center gap-1.5 text-[15px]">
        <RouterLink to="/jobs" class="inline-flex items-center gap-1 font-semibold hover:underline">
          <PhCaretLeft :size="16" />
          Jobs
        </RouterLink>
        <span v-if="application" class="truncate text-muted-foreground">/ {{ application.companyName }}</span>
      </nav>
      <Button v-if="application?.jobDescriptionLink" variant="outline" size="sm" as-child>
        <a :href="application.jobDescriptionLink" target="_blank" rel="noopener noreferrer nofollow">
          Open posting
          <PhArrowUpRight />
        </a>
      </Button>
    </PageHeader>

    <div v-if="application" class="flex flex-col gap-6 px-4 pb-12 lg:px-6">
      <div class="flex items-center gap-4">
        <CompanyAvatar :company-name="application.companyName" :logo-url="application.companyLogoUrl" class="size-12 text-base lg:size-14" />
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="text-2xl font-extrabold break-words lg:text-[34px]">{{ application.position }}</h1>
          <p class="text-[15px] text-soft-foreground lg:text-base">{{ subtitle }}</p>
        </div>
      </div>

      <JobStageStepper :job="application" />

      <Alert v-if="showJustCreatedPrompt" class="flex items-center justify-between">
        <PhCheckCircle class="size-4 text-success" />
        <AlertDescription class="flex flex-wrap items-center gap-3">
          <span>Saved to your tracker. Have you applied yet?</span>
          <div class="flex shrink-0 gap-2">
            <Button size="sm" @click="markCreatedApplied"><PhCheck />I've applied</Button>
            <Button size="sm" variant="outline" @click="justCreatedDismissed = true">Not yet</Button>
          </div>
        </AlertDescription>
      </Alert>

      <NextStepCard
        v-else
        :job="application"
        :upcoming-interview="upcomingInterview"
        :now="now"
        @draft-follow-up="openTemplate('follow_up')"
      />

      <div v-if="hasInterview || application.status === 'offered'" class="flex flex-wrap gap-2">
        <Button v-if="hasInterview" variant="outline" size="sm" @click="openTemplate('thank_you')">
          Draft thank-you note
        </Button>
        <Button v-if="application.status === 'offered'" variant="outline" size="sm" @click="openTemplate('offer_response')">
          Draft offer response
        </Button>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-5">
          <JobPostingSignals
            v-if="signs.length && !isWide"
            :lines="signs"
            :key-hash="application.jobKeyHash ?? ''"
          />
          <ToolMatchCard
            v-if="application.toolMatch"
            :match="application.toolMatch"
            :just-saved="route.query.from === 'tool'"
            @mark-applied="markApplied(application.id)"
          />
          <Alert
            v-else-if="resumes.length === 0 && !isResumeBannerDismissed"
            class="flex flex-col justify-between sm:flex-row sm:items-center"
          >
            <PhUploadSimple class="size-4" />
            <AlertDescription class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span><strong>See how you stack up.</strong> Upload a resume to check it against this job.</span>
              <Button size="sm" class="shrink-0" :disabled="isUploading" @click="openFileDialog()">
                {{ isUploading ? "Uploading…" : "Upload resume" }}
              </Button>
            </AlertDescription>
            <Button variant="ghost" size="icon-sm" class="shrink-0 self-end sm:self-auto" aria-label="Dismiss" @click="dismissResumeBanner">
              <PhX class="size-4" />
            </Button>
          </Alert>

          <JobTimeline
            :entries="timeline.entries.value"
            :add-note="timeline.addNote"
            :update-note="timeline.updateNote"
            :save-interview="timeline.saveInterview"
            :set-interview-status="timeline.setInterviewStatus"
            :save-contact="timeline.saveContact"
            :remove="timeline.remove"
          />
        </div>

        <div class="flex min-w-0 flex-col gap-5">
          <JobPostingSignals
            v-if="signs.length && isWide"
            :lines="signs"
            :key-hash="application.jobKeyHash ?? ''"
          />
          <JobApplicationAttachments :application="application" />
          <JobApplicationDescription :application="application" />
          <Card class="gap-2">
            <CardHeader><CardTitle class="text-base">Details</CardTitle></CardHeader>
            <CardContent>
              <dl class="flex flex-col gap-2 text-sm">
                <div v-for="detail in details" :key="detail.label" class="flex justify-between gap-4">
                  <dt class="text-muted-foreground">{{ detail.label }}</dt>
                  <dd class="text-right font-semibold">{{ detail.value }}</dd>
                </div>
              </dl>
              <JobReportSection v-if="signalsEnabled && application.jobKeyHash" :job="application" :now="now" class="mt-3" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <FollowUpDialog
      :job="followUpJob"
      :type="followUpType"
      :contact-name="latestContactName"
      @close="followUpJob = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { useRoute } from "vue-router";
import { useDocument } from "vuefire";
import { collection, doc } from "firebase/firestore";
import { useIntervalFn, useMediaQuery } from "@vueuse/core";
import {
  PhArrowUpRight,
  PhCaretLeft,
  PhCheck,
  PhCheckCircle,
  PhUploadSimple,
  PhX,
} from "@phosphor-icons/vue";
import { db } from "@/firebase/config.ts";
import PageHeader from "@/components/PageHeader.vue";
import JobApplicationAttachments from "@/components/JobApplicationAttachments.vue";
import JobApplicationDescription from "@/components/JobApplicationDescription.vue";
import ToolMatchCard from "@/components/ToolMatchCard.vue";
import CompanyAvatar from "@/components/jobs/CompanyAvatar.vue";
import FollowUpDialog from "@/components/jobs/FollowUpDialog.vue";
import JobPostingSignals from "@/components/job/JobPostingSignals.vue";
import JobReportSection from "@/components/job/JobReportSection.vue";
import JobStageStepper from "@/components/job/JobStageStepper.vue";
import JobTimeline from "@/components/job/JobTimeline.vue";
import NextStepCard from "@/components/job/NextStepCard.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { useJobSignals } from "@/composables/useJobSignals";
import { useJobTimeline } from "@/composables/useJobTimeline";
import { useResumes } from "@/composables/useResumes";
import { useResumeUpload } from "@/composables/useResumeUpload";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import type { TimelineEntry } from "@/lib/timeline";
import type { FollowUpTemplateType, JobApplication } from "@/types";

const { jobId } = defineProps<{ jobId: string }>();
const route = useRoute();

const { data: application } = useDocument<JobApplication>(doc(collection(db, "jobApplications"), jobId));
const timeline = useJobTimeline(application, jobId);
const { markApplied } = useUpdateJobApplicationStatus();

const now = ref(new Date());
useIntervalFn(() => (now.value = new Date()), 60_000);

const signs = useJobSignals(application, now);
const signalsEnabled = useFeatureFlag("job-signals");
// Before the timeline on phones, where the side column ends up last
const isWide = useMediaQuery("(min-width: 1024px)");

const REMOTE_LABELS = { remote: "Remote", hybrid: "Hybrid", "in-office": "On site" } as const;
const EMPLOYMENT_LABELS = { "full-time": "Full time", "part-time": "Part time" } as const;

const subtitle = computed(() => {
  const job = application.value;
  if (!job) return "";
  return [job.companyName, job.remotePolicy && REMOTE_LABELS[job.remotePolicy]].filter(Boolean).join(" · ");
});

const details = computed(() => {
  const job = application.value;
  if (!job) return [];
  return [
    { label: "Work", value: job.remotePolicy ? REMOTE_LABELS[job.remotePolicy] : "Not listed" },
    { label: "Type", value: job.employmentType ? EMPLOYMENT_LABELS[job.employmentType] : "Not listed" },
    { label: "Salary", value: job.salary || "Not listed" },
    { label: "Saved", value: job.createdAt?.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) ?? "" },
  ];
});

const upcomingInterview = computed(
  () =>
    (timeline.entries.value.find((entry) => entry.kind === "interview" && entry.upcoming) as
      | Extract<TimelineEntry, { kind: "interview" }>
      | undefined) ?? null,
);

const hasInterview = computed(() => timeline.entries.value.some((entry) => entry.kind === "interview"));
const latestContactName = computed(() => {
  const contacts = timeline.contacts.value;
  const contact = contacts?.[contacts.length - 1];
  return contact ? `${contact.firstName} ${contact.lastName}`.trim() || undefined : undefined;
});

const followUpJob = shallowRef<JobApplication | null>(null);
const followUpType = ref<FollowUpTemplateType>("follow_up");

function openTemplate(type: FollowUpTemplateType) {
  followUpType.value = type;
  followUpJob.value = application.value ?? null;
}

const { data: resumes } = useResumes();
const { openFileDialog, isUploading } = useResumeUpload();
const readBannerDismissed = () => {
  try {
    return localStorage.getItem("dismiss-resume-banner") === "true";
  } catch {
    return false;
  }
};
const isResumeBannerDismissed = ref(readBannerDismissed());
function dismissResumeBanner() {
  isResumeBannerDismissed.value = true;
  try {
    localStorage.setItem("dismiss-resume-banner", "true");
  } catch {
    // storage blocked: dismissed for this visit only
  }
}

// Shown once right after a manual/link-parse save (?created=1); the tool
// handoff has its own success moment on ToolMatchCard instead.
const justCreatedDismissed = ref(false);
const showJustCreatedPrompt = computed(
  () => route.query.created === "1" && !justCreatedDismissed.value && !application.value?.toolMatch,
);
async function markCreatedApplied() {
  await markApplied(jobId);
  justCreatedDismissed.value = true;
}
</script>

<route lang="yaml">
props: true
meta:
  requiresAuth: true
</route>
