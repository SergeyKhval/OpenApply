<template>
  <Card class="flex flex-col gap-3 group relative overflow-hidden">
    <CardHeader class="overflow-hidden">
      <div class="flex items-center gap-2 min-w-0">
        <Avatar class="rounded size-12 flex-shrink-0">
          <AvatarImage :src="application.companyLogoUrl || ''" />
          <AvatarFallback class="rounded uppercase">
            {{ application.companyName.substring(0, 2) }}
          </AvatarFallback>
        </Avatar>

        <div class="min-w-0 flex-1 overflow-hidden">
          <CardTitle class="truncate">
            <RouterLink
              :to="`/dashboard/applications/${application.id}`"
              class="underline hover:no-underline text-lg"
            >
              {{ application.companyName }}
            </RouterLink>
          </CardTitle>

          <CardDescription class="truncate" :title="application.position">
            {{ application.position }}
          </CardDescription>
        </div>
      </div>
    </CardHeader>

    <CardContent class="flex flex-col gap-0.5 grow">
      <div
        v-if="application.jobDescriptionLink"
        class="flex items-center gap-2"
      >
        <PhLinkSimple class="text-muted-foreground" />
        <a
          :href="application.jobDescriptionLink"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-primary hover:underline truncate flex-1"
          @click.stop
        >
          View Job Description
        </a>
      </div>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <PhCalendar size="16" />
        <span> Applied: {{ humanReadableAppliedAt }}</span>
      </div>

      <div
        v-if="application.status === 'archived' && application.archivedAt"
        class="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <PhArchive size="16" />
        <span>
          Archived:
          {{ application.archivedAt?.toDate().toLocaleDateString() }}</span
        >
      </div>

      <div class="flex items-center gap-2 my-3">
        <ResumeActionButton
          :application-id="application.id"
          :resume-id="application.resumeId"
        />
        <CoverLetterActionButton
          :application-id="application.id"
          :cover-letter-id="application.coverLetterId"
        />
      </div>

      <!-- Technologies badges -->
      <div
        v-if="application.technologies && application.technologies.length > 0"
        class="flex flex-wrap gap-1 mt-2"
      >
        <Badge
          v-for="tech in visibleTechnologies"
          :key="tech"
          variant="outline"
          class="text-xs"
        >
          {{ tech }}
        </Badge>
        <Popover v-if="hasMoreTechnologies" v-model:open="showAllTechnologies">
          <PopoverTrigger as-child>
            <Button variant="ghost" size="sm" class="h-5 px-1">
              <PhDotsThree class="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto max-w-sm p-2">
            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="tech in application.technologies"
                :key="tech"
                variant="outline"
                class="text-xs"
              >
                {{ tech }}
              </Badge>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </CardContent>

    <CardFooter>
      <DropdownMenu v-if="application.status !== 'archived'">
        <DropdownMenuTrigger as-child>
          <Button size="sm" variant="outline" class="capitalize">
            {{ application.status }}
            <PhCaretDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Change status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-for="status in JOB_STATUSES"
            :key="status"
            class="capitalize"
            @click="updateJobApplicationStatus(application.id, status)"
          >
            {{ status }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        v-else
        variant="outline"
        size="sm"
        title="Restore from archive"
        @click="restoreJobApplication(application)"
      >
        <PhClockClockwise />
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { JobApplication, JobStatus } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLocalTimeZone } from "@internationalized/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PhArchive,
  PhCalendar,
  PhClockClockwise,
  PhLinkSimple,
  PhDotsThree,
  PhCaretDown,
} from "@phosphor-icons/vue";
import { restoreJobApplication } from "@/firebase/restoreJobApplication.ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus.ts";
import CoverLetterActionButton from "@/components/CoverLetterActionButton.vue";
import ResumeActionButton from "@/components/ResumeActionButton.vue";

const DEFAULT_VISIBLE_TECHNOLOGIES = 5;
const JOB_STATUSES: JobStatus[] = [
  "applied",
  "interviewing",
  "offered",
  "hired",
  "archived",
];

type JobApplicationCardProps = {
  application: JobApplication;
};

const { application } = defineProps<JobApplicationCardProps>();

const { updateJobApplicationStatus } = useUpdateJobApplicationStatus();

const localTimezone = getLocalTimeZone();
const showAllTechnologies = ref(false);

const humanReadableAppliedAt = computed(() =>
  application.appliedAt?.toDate(localTimezone).toLocaleDateString(),
);

const visibleTechnologies = computed(() => {
  if (!application.technologies) return [];
  return application.technologies.slice(0, DEFAULT_VISIBLE_TECHNOLOGIES);
});

const hasMoreTechnologies = computed(
  () =>
    application.technologies &&
    application.technologies.length > DEFAULT_VISIBLE_TECHNOLOGIES,
);
</script>
