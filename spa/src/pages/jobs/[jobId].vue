<template>
  <div>
    <!-- No header bar here (canvas "Job detail"): breadcrumb and actions sit on the page -->
    <header class="flex items-center gap-3 px-4 pt-4 lg:px-11 lg:pt-7">
      <nav aria-label="Breadcrumb" class="flex min-w-0 grow items-center gap-1.5 text-[15px]">
        <RouterLink to="/jobs" class="inline-flex items-center gap-1 font-semibold text-secondary-foreground hover:underline">
          <PhCaretLeft :size="16" />
          Jobs
        </RouterLink>
        <span v-if="application" class="hidden truncate text-muted-foreground lg:inline">/ {{ application.companyName }}</span>
      </nav>
      <Button v-if="application?.jobDescriptionLink" variant="outline" size="sm" class="hidden lg:inline-flex" as-child>
        <a :href="application.jobDescriptionLink" target="_blank" rel="noopener noreferrer nofollow">
          Open posting
          <PhArrowUpRight />
        </a>
      </Button>
      <DropdownMenu v-if="application">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" aria-label="Job actions">
            <PhDotsThree :size="20" weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem v-if="application.jobDescriptionLink" as-child class="lg:hidden">
            <a :href="application.jobDescriptionLink" target="_blank" rel="noopener noreferrer nofollow">
              <PhArrowUpRight />Open posting
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" @select="isDeleteOpen = true"><PhTrash />Delete job</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div v-if="application" class="flex flex-col gap-6 px-4 pt-4 pb-12 lg:px-11 lg:pt-6">
      <div class="flex items-center gap-4">
        <CompanyAvatar :company-name="application.companyName" :logo-url="application.companyLogoUrl" class="size-12 text-base lg:size-14" />
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="text-2xl font-extrabold break-words lg:text-[34px]">{{ application.position }}</h1>
          <p class="text-[15px] text-soft-foreground lg:text-base">
            {{ subtitle }}<span v-if="subtitleExtra" class="hidden lg:inline"> · {{ subtitleExtra }}</span>
          </p>
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
        @edit-interview="editUpcomingInterview"
        @interview-status="(status) => upcomingInterview && timeline.setInterviewStatus(upcomingInterview.id, status)"
      />

      <!-- Left: match and timeline. Right: posting signals, what was sent, people,
           description, details. On phones the columns stack in that order. -->
      <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-5">
          <JobPostingSignals
            v-if="signs.length && !isWide"
            :lines="signs"
            :key-hash="application.jobKeyHash ?? ''"
          />
          <JobMatchCard :application="application" :resumes="resumes">
            <!-- Jobs saved from the free tool keep that check until a match is run here -->
            <template v-if="application.toolMatch" #fallback>
              <ToolMatchCard
                :match="application.toolMatch"
                :just-saved="route.query.from === 'tool'"
                @mark-applied="markApplied(application.id)"
              />
            </template>
          </JobMatchCard>

          <JobTimeline
            ref="timelineCard"
            :entries="timeline.entries.value"
            :add-note="timeline.addNote"
            :update-note="timeline.updateNote"
            :save-interview="timeline.saveInterview"
            :set-interview-status="timeline.setInterviewStatus"
            :save-contact="timeline.saveContact"
            :remove="timeline.remove"
            :follow-up-templates="followUpTemplates"
            @draft="openTemplate"
          />
        </div>

        <div class="flex min-w-0 flex-col gap-5">
          <JobPostingSignals
            v-if="signs.length && isWide"
            :lines="signs"
            :key-hash="application.jobKeyHash ?? ''"
          />
          <SentWithCard :application="application" :resumes="resumes" />
          <JobPeopleCard v-if="timeline.contacts.value?.length" :contacts="timeline.contacts.value" />
          <JobApplicationDescription :application="application" />
          <Card class="gap-3">
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

    <Dialog v-model:open="isDeleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this job?</DialogTitle>
          <DialogDescription>
            {{ application?.companyName }}, {{ application?.position }}, with its notes, interviews, contacts,
            matches and cover letter. This can't be undone. To keep it but get it off the board, close it instead.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isDeleteOpen = false">Cancel</Button>
          <Button variant="destructive" :disabled="isDeleting" @click="deleteJob">
            {{ isDeleting ? "Deleting…" : "Delete job" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDocument } from "vuefire";
import { collection, doc } from "firebase/firestore";
import { useIntervalFn, useMediaQuery } from "@vueuse/core";
import { PhArrowUpRight, PhCaretLeft, PhCheck, PhCheckCircle, PhDotsThree, PhTrash } from "@phosphor-icons/vue";
import { db } from "@/firebase/config.ts";
import JobApplicationDescription from "@/components/JobApplicationDescription.vue";
import ToolMatchCard from "@/components/ToolMatchCard.vue";
import CompanyAvatar from "@/components/jobs/CompanyAvatar.vue";
import FollowUpDialog from "@/components/jobs/FollowUpDialog.vue";
import JobMatchCard from "@/components/job/JobMatchCard.vue";
import JobPeopleCard from "@/components/job/JobPeopleCard.vue";
import JobPostingSignals from "@/components/job/JobPostingSignals.vue";
import JobReportSection from "@/components/job/JobReportSection.vue";
import JobStageStepper from "@/components/job/JobStageStepper.vue";
import JobTimeline from "@/components/job/JobTimeline.vue";
import NextStepCard from "@/components/job/NextStepCard.vue";
import SentWithCard from "@/components/job/SentWithCard.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { useJobApplications } from "@/composables/useJobApplications";
import { useJobSignals } from "@/composables/useJobSignals";
import { useJobTimeline } from "@/composables/useJobTimeline";
import { useResumes } from "@/composables/useResumes";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import { foundViaLabel } from "@/lib/jobSource";
import type { TimelineEntry } from "@/lib/timeline";
import type { FollowUpTemplateType, JobApplication } from "@/types";

const { jobId } = defineProps<{ jobId: string }>();
const route = useRoute();
const router = useRouter();

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
// Desktop only, as in the canvas: salary and where the posting came from
const foundVia = computed(() => foundViaLabel(application.value?.jobDescriptionLink));
const subtitleExtra = computed(() =>
  [application.value?.salary, foundVia.value && `Found via ${foundVia.value}`].filter(Boolean).join(" · "),
);

const details = computed(() => {
  const job = application.value;
  if (!job) return [];
  return [
    { label: "Salary", value: job.salary || "Not listed" },
    { label: "Work", value: job.remotePolicy ? REMOTE_LABELS[job.remotePolicy] : "Not listed" },
    ...(job.employmentType ? [{ label: "Type", value: EMPLOYMENT_LABELS[job.employmentType] }] : []),
    ...(foundVia.value ? [{ label: "Found via", value: foundVia.value }] : []),
  ];
});

// Pending only: marking it passed or not moves the next step on
const upcomingInterview = computed(
  () =>
    (timeline.entries.value.find(
      (entry) => entry.kind === "interview" && entry.upcoming && entry.interview.status === "pending",
    ) as
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

const followUpTemplates = computed(() => [
  { type: "follow_up" as const, label: "Follow-up email" },
  ...(hasInterview.value ? [{ type: "thank_you" as const, label: "Thank-you note" }] : []),
  ...(application.value?.status === "offered" ? [{ type: "offer_response" as const, label: "Offer response" }] : []),
]);

const timelineCard = ref<InstanceType<typeof JobTimeline> | null>(null);
function editUpcomingInterview() {
  if (!upcomingInterview.value) return;
  timelineCard.value?.edit(upcomingInterview.value.id);
  timelineCard.value?.$el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

function openTemplate(type: FollowUpTemplateType) {
  followUpType.value = type;
  followUpJob.value = application.value ?? null;
}

const { data: resumes } = useResumes();

// Shown once right after a manual/link-parse save (?created=1); the tool
// handoff has its own success moment on ToolMatchCard instead.
const justCreatedDismissed = ref(false);
const showJustCreatedPrompt = computed(
  () => route.query.created === "1" && !justCreatedDismissed.value && !application.value?.toolMatch,
);
const { deleteJobApplication } = useJobApplications();
const { toast } = useToast();
const isDeleteOpen = ref(false);
const isDeleting = ref(false);
async function deleteJob() {
  isDeleting.value = true;
  const result = await deleteJobApplication(jobId);
  isDeleting.value = false;
  if (result.success) {
    isDeleteOpen.value = false;
    await router.push("/jobs");
    return;
  }
  toast({ title: "Couldn't delete the job", description: "Nothing was removed. Try again in a moment.", variant: "destructive" });
}

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
