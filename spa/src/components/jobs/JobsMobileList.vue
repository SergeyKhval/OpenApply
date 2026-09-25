<!-- Below lg the board doesn't fit: jobs grouped by stage, chips to filter -->
<template>
  <div class="flex flex-col gap-5">
    <div class="-mr-4 flex gap-2 overflow-x-auto pr-4 hide-scrollbar" role="group" aria-label="Filter by stage">
      <Button
        v-for="chip in chips"
        :key="chip.value"
        size="sm"
        :variant="filter === chip.value ? 'default' : 'outline'"
        :aria-pressed="filter === chip.value"
        class="shrink-0"
        @click="filter = chip.value"
      >
        {{ chip.label }}
      </Button>
    </div>

    <section v-for="group in groups" :key="group.stage" class="flex flex-col gap-3">
      <h3 class="flex items-baseline gap-2 text-[17px] font-bold">
        {{ STAGE_LABELS[group.stage] }}
        <span class="font-sans text-[15px] font-normal text-muted-foreground">{{ group.jobs.length }}</span>
      </h3>
      <JobCard v-for="job in group.jobs" :key="job.id" :job="job" :now="now" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import JobCard from "@/components/jobs/JobCard.vue";
import { OPEN_STAGES, STAGE_LABELS, stageOf, type OpenStage } from "@/lib/stages";
import type { JobApplication } from "@/types";

const { jobs, now } = defineProps<{ jobs: JobApplication[]; now: Date }>();

// Most actionable first: jobs waiting on a reply, then ones to apply to
const GROUP_ORDER: OpenStage[] = ["applied", "interviewing", "offer", "saved"];

const filter = ref<OpenStage | "all">("all");

const openJobs = computed(() => jobs.filter((job) => stageOf(job.status) !== "closed"));

const chips = computed(() => [
  { value: "all" as const, label: `All ${openJobs.value.length}` },
  ...OPEN_STAGES.map((stage) => ({
    value: stage,
    label: `${STAGE_LABELS[stage]} ${openJobs.value.filter((job) => stageOf(job.status) === stage).length}`,
  })),
]);

const groups = computed(() =>
  GROUP_ORDER.filter((stage) => filter.value === "all" || filter.value === stage)
    .map((stage) => ({ stage, jobs: openJobs.value.filter((job) => stageOf(job.status) === stage) }))
    .filter((group) => group.jobs.length),
);
</script>
