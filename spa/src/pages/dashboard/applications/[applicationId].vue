<template>
  <div>
    <PageHeader>
      <h2
        class="text-2xl font-semibold whitespace-nowrap capitalize flex items-center gap-2 grow"
      >
        <RouterLink
          to="/dashboard/applications"
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
        <div v-else class="text-lg flex gap-2 mb-3">
          <span
            v-for="(status, index) in statusBar"
            :key="status.name"
            class="flex items-center gap-2"
            :class="
              status.isActive ? 'text-foreground' : 'text-muted-foreground'
            "
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="hover:no-underline cursor-pointer text-xs lg:text-base"
                  :class="{ underline: !status.isActive }"
                  @click="updateJobApplicationStatus(status.status)"
                >
                  {{ status.name }}
                </button>
              </TooltipTrigger>
              <TooltipContent :side-offset="-5">
                <span>Update status to {{ status.name }}</span>
              </TooltipContent>
            </Tooltip>

            <PhCaretRight
              v-if="index + 1 < statusBar.length"
              :class="
                status.isCaretActive
                  ? 'text-foreground'
                  : 'text-foreground-muted'
              "
              size="16"
            />

            <span
              class="flex"
              v-if="
                application.status === 'hired' && index + 1 === statusBar.length
              "
            >
              <PhFire size="20" class="text-amber-400" />
              <PhHandsClapping size="20" class="text-foreground" />
            </span>
          </span>
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

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="flex flex-col gap-4">
          <JobApplicationInterviews :application-id="applicationId" />

          <JobApplicationNotes :application-id="applicationId" />
        </div>

        <div class="flex flex-col gap-4">
          <JobApplicationContacts :application-id="applicationId" />

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-4 sm:flex-row">
              <Empty
                class="sm:w-50 relative pb-5 pt-10 px-2 gap-4"
                :class="application?.resumeId && 'border-solid'"
              >
                <Badge variant="secondary" class="absolute top-2 left-2">
                  Resume
                </Badge>

                <EmptyIcon
                  :class="
                    application?.resumeId &&
                    'border-solid text-foreground border-foreground'
                  "
                >
                  <PhFilePdf v-if="application?.resumeId" :size="36" />
                  <PhReadCvLogo v-else :size="36" />
                </EmptyIcon>
                <EmptyDescription class="text-foreground">
                  <div
                    v-if="application?.resumeId"
                    class="items-center gap-2 flex"
                  >
                    <Button size="sm" variant="outline" @click="openResume">
                      <PhEye />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="
                        $router.replace({
                          query: {
                            ...$route.query,
                            'dialog-name': 'resume-picker',
                            'application-id': applicationId,
                            'resume-id': application?.resumeId || '',
                          },
                        })
                      "
                    >
                      <PhPencilSimple />
                      Change
                    </Button>
                  </div>
                  <template v-else>
                    <Button
                      variant="outline"
                      size="sm"
                      @click="
                        $router.replace({
                          query: {
                            ...$route.query,
                            'dialog-name': 'resume-picker',
                            'application-id': applicationId,
                            'resume-id': application?.resumeId || '',
                          },
                        })
                      "
                    >
                      <PhFilePdf />
                      Attach
                    </Button></template
                  >
                </EmptyDescription>
              </Empty>

              <Empty
                class="sm:w-50 pb-5 pt-10 px-2 gap-4 relative"
                :class="{ 'border-solid': application?.coverLetterId }"
              >
                <Badge variant="secondary" class="absolute top-2 left-2"
                  >Cover Letter</Badge
                >
                <EmptyIcon
                  :class="{
                    'border-solid text-foreground border-foreground':
                      application?.coverLetterId,
                  }"
                >
                  <PhEnvelopeSimpleOpen
                    v-if="application?.coverLetterId"
                    :size="36"
                  />
                  <PhEnvelopeSimple v-else :size="36" />
                </EmptyIcon>
                <EmptyDescription class="text-foreground">
                  <Button
                    v-if="application?.coverLetterId"
                    variant="outline"
                    size="sm"
                    @click="
                      $router.replace({
                        query: {
                          ...$route.query,
                          'dialog-name': 'cover-letter-preview',
                          'cover-letter-id': application.coverLetterId,
                        },
                      })
                    "
                  >
                    <PhEye />
                    View
                  </Button>
                  <Button
                    v-else
                    size="sm"
                    variant="outline"
                    @click="
                      $router.replace({
                        query: {
                          ...$route.query,
                          'dialog-name': 'generate-cover-letter',
                          'application-id': applicationId,
                        },
                      })
                    "
                  >
                    <PhSparkle />
                    Generate
                  </Button>
                </EmptyDescription>
              </Empty>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from "vue";
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
  PhClockClockwise,
  PhFire,
  PhHandsClapping,
  PhEye,
  PhEnvelopeSimple,
  PhEnvelopeSimpleOpen,
  PhReadCvLogo,
  PhSparkle,
  PhFilePdf,
  PhPencilSimple,
} from "@phosphor-icons/vue";
import { JobApplication, JobStatus, Resume } from "@/types";
import { db } from "@/firebase/config.ts";
import PageHeader from "@/components/PageHeader.vue";
import JobApplicationNotes from "@/components/JobApplicationNotes.vue";
import JobApplicationContacts from "@/components/JobApplicationContacts.vue";
import JobApplicationInterviews from "@/components/JobApplicationInterviews.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { restoreJobApplication } from "@/firebase/restoreJobApplication.ts";
import { getLocalTimeZone, today } from "@internationalized/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Empty, EmptyDescription, EmptyIcon } from "@/components/ui/empty";
import AddJobApplicationDropdown from "@/components/AddJobApplicationDropdown.vue";

type ApplicationPageProps = {
  applicationId: string;
};

const { applicationId } = defineProps<ApplicationPageProps>();

const { data: application } = useDocument<JobApplication>(
  doc(collection(db, "jobApplications"), applicationId),
);

const statusBar = computed(() => {
  if (!application.value) return [];
  const statuses: JobStatus[] = ["applied", "interviewing", "offered", "hired"];
  const activeStatusIndex = statuses.indexOf(application.value.status);
  return statuses.map((status, index) => ({
    status,
    name: {
      applied: "Applied",
      interviewing: "Interviewing",
      offered: "Job Offer",
      hired: "Hired",
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

async function openResume() {
  if (!application.value?.resumeId) return;

  const resume = useDocument<Resume>(
    doc(collection(db, "userResumes"), application.value.resumeId),
    { once: true },
  );

  const unwatch = watchEffect(() => {
    if (resume.value?.url) {
      window.open(resume.value.url, "_blank");
      unwatch();
    }
  });
}
</script>

<route lang="yaml">
props: true
meta:
  requiresAuth: true
</route>
