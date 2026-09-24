<template>
  <!-- When the board is narrower than ~68rem the Closed column doesn't fit:
       it becomes a link above the lanes (container query on the board's width) -->
  <div class="@container">
  <RouterLink
    v-if="closedJobs.length"
    :to="{ path: '/jobs', query: { stage: 'closed' } }"
    class="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground @min-[68rem]:hidden"
  >
    <PhArchive :size="16" />
    Closed · {{ closedJobs.length }}
  </RouterLink>
  <div class="grid grid-cols-4 items-start gap-4 @min-[68rem]:grid-cols-[repeat(4,minmax(0,1fr))_170px]">
    <section
      v-for="stage in OPEN_STAGES"
      :key="stage"
      :aria-label="STAGE_LABELS[stage]"
      class="flex flex-col gap-3 rounded-[22px] p-3.5"
      :class="LANE_CLASSES[stage]"
    >
      <header class="flex items-center justify-between px-1">
        <h3 class="text-[17px] font-bold">{{ STAGE_LABELS[stage] }}</h3>
        <span
          class="grid h-6 min-w-7 place-items-center rounded-full bg-card px-2 text-[13px] font-bold"
          :class="COUNT_CLASSES[stage]"
        >
          {{ jobsByStage[stage].length }}
        </span>
      </header>
      <JobCard v-for="job in jobsByStage[stage]" :key="job.id" :job="job" :now="now" />
      <p v-if="!jobsByStage[stage].length" class="px-1 pb-1 text-sm text-muted-foreground">
        {{ EMPTY_HINTS[stage] }}
      </p>
    </section>

    <section aria-label="Closed" class="hidden flex-col gap-3 rounded-[22px] bg-stage-closed-soft p-3.5 @min-[68rem]:flex">
      <header class="flex items-center justify-between px-1">
        <h3 class="text-[17px] font-bold">Closed</h3>
        <span class="grid h-6 min-w-7 place-items-center rounded-full bg-card px-2 text-[13px] font-bold text-stage-closed-text">
          {{ closedJobs.length }}
        </span>
      </header>
      <ul v-if="closedJobs.length" class="flex flex-col gap-1.5 px-1 text-sm text-soft-foreground">
        <li v-for="[reason, count] in closedCounts" :key="reason">
          {{ CLOSED_REASON_LABELS[reason] }} · {{ count }}
        </li>
      </ul>
      <Button
        v-if="closedJobs.length"
        variant="ghost"
        size="sm"
        class="self-start"
        as-child
      >
        <RouterLink :to="{ path: '/jobs', query: { stage: 'closed' } }">
          <PhArchive />
          Show
        </RouterLink>
      </Button>
      <p v-else class="px-1 pb-1 text-sm text-muted-foreground">Nothing closed yet.</p>
    </section>
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhArchive } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import JobCard from "@/components/jobs/JobCard.vue";
import {
  CLOSED_REASON_LABELS,
  CLOSED_REASONS,
  closedReason,
  OPEN_STAGES,
  STAGE_LABELS,
  stageOf,
  type ClosedReason,
  type OpenStage,
} from "@/lib/stages";
import type { JobApplication } from "@/types";

const { jobs, now } = defineProps<{ jobs: JobApplication[]; now: Date }>();

const LANE_CLASSES: Record<OpenStage, string> = {
  saved: "bg-stage-saved-soft",
  applied: "bg-stage-applied-soft",
  interviewing: "bg-stage-interviewing-soft",
  offer: "bg-stage-offer-soft",
};
const COUNT_CLASSES: Record<OpenStage, string> = {
  saved: "text-stage-saved-text",
  applied: "text-stage-applied-text",
  interviewing: "text-stage-interviewing-text",
  offer: "text-stage-offer-text",
};
const EMPTY_HINTS: Record<OpenStage, string> = {
  saved: "Jobs you save land here.",
  applied: "Mark a saved job as applied.",
  interviewing: "No interviews yet.",
  offer: "No offers yet.",
};

const jobsByStage = computed(() => {
  const lanes: Record<OpenStage, JobApplication[]> = { saved: [], applied: [], interviewing: [], offer: [] };
  for (const job of jobs) {
    const stage = stageOf(job.status);
    if (stage !== "closed") lanes[stage].push(job);
  }
  return lanes;
});

const closedJobs = computed(() => jobs.filter((job) => stageOf(job.status) === "closed"));

const closedCounts = computed(() =>
  CLOSED_REASONS.map(
    (reason) =>
      [reason, closedJobs.value.filter((job) => closedReason(job.status) === reason).length] as [ClosedReason, number],
  ).filter(([, count]) => count > 0),
);
</script>
