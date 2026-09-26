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
      class="flex flex-col gap-3 rounded-[22px] p-3.5 outline-2 outline-offset-2 outline-transparent transition-[outline-color]"
      :class="[LANE_CLASSES[stage], isDragOver(stage) && '!outline-ring']"
      :data-drag-over="isDragOver(stage) || undefined"
      @dragover.prevent="onDragOverLane(stage)"
      @dragleave="onDragLeaveLane(stage)"
      @drop.prevent="onDrop(stage)"
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
      <div
        v-for="job in jobsByStage[stage]"
        :key="job.id"
        draggable="true"
        :data-job-id="job.id"
        :data-dragging="draggedJobId === job.id || undefined"
        class="transition-[opacity,transform,box-shadow] duration-150"
        :class="draggedJobId === job.id && 'scale-[0.98] opacity-60 shadow-pop'"
        @dragstart="onDragStart($event, job)"
        @dragend="onDragEnd"
      >
        <JobCard :job="job" :now="now" />
      </div>
      <p v-if="!jobsByStage[stage].length" class="px-1 pb-1 text-sm text-muted-foreground">
        {{ EMPTY_HINTS[stage] }}
      </p>
    </section>

    <section
      aria-label="Closed"
      class="hidden flex-col gap-3 rounded-[22px] bg-stage-closed-soft p-3.5 outline-2 outline-offset-2 outline-transparent transition-[outline-color] @min-[68rem]:flex"
      :class="isDragOver('closed') && '!outline-ring'"
      :data-drag-over="isDragOver('closed') || undefined"
      @dragover.prevent="onDragOverLane('closed')"
      @dragleave="onDragLeaveLane('closed')"
      @drop.prevent="onDrop('closed')"
    >
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

      <!-- Dropping a card here asks for a close reason, same choices as the stage menu's "Close as" -->
      <DropdownMenu :open="closeMenuOpen" @update:open="onCloseMenuOpenChange">
        <DropdownMenuTrigger as-child>
          <span class="sr-only" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel class="text-muted-foreground text-xs font-medium">Close as</DropdownMenuLabel>
          <DropdownMenuItem v-for="reason in CLOSED_REASONS" :key="reason" @select="chooseCloseReason(reason)">
            {{ CLOSED_REASON_LABELS[reason] }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PhArchive } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import JobCard from "@/components/jobs/JobCard.vue";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import {
  CLOSED_REASON_LABELS,
  CLOSED_REASONS,
  closedReason,
  OPEN_STAGES,
  STAGE_LABELS,
  stageOf,
  type ClosedReason,
  type OpenStage,
  type Stage,
} from "@/lib/stages";
import type { JobApplication } from "@/types";

const { jobs, now } = defineProps<{ jobs: JobApplication[]; now: Date }>();

const { updateJobApplicationStatus, moveToStage } = useUpdateJobApplicationStatus();

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

// Native HTML5 drag and drop: dragging a card between lanes goes through the same
// moveToStage/updateJobApplicationStatus path as the stage menu and stepper.
const draggedJobId = ref<string | null>(null);
const dragOverStage = ref<Stage | null>(null);
const closeMenuOpen = ref(false);
const pendingCloseJob = ref<JobApplication | null>(null);

const isDragOver = (stage: Stage) => !!draggedJobId.value && dragOverStage.value === stage;

function onDragStart(event: DragEvent, job: JobApplication) {
  draggedJobId.value = job.id;
  event.dataTransfer?.setData("text/plain", job.id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function onDragEnd() {
  draggedJobId.value = null;
  dragOverStage.value = null;
}

function onDragOverLane(stage: Stage) {
  if (!draggedJobId.value) return;
  dragOverStage.value = stage;
}

function onDragLeaveLane(stage: Stage) {
  if (dragOverStage.value === stage) dragOverStage.value = null;
}

function onDrop(stage: Stage) {
  dragOverStage.value = null;
  const jobId = draggedJobId.value;
  draggedJobId.value = null;
  if (!jobId) return;
  const job = jobs.find((candidate) => candidate.id === jobId);
  if (!job) return;

  if (stage === "closed") {
    pendingCloseJob.value = job;
    closeMenuOpen.value = true;
    return;
  }
  if (stageOf(job.status) === stage) return;
  moveToStage(job, stage);
}

function onCloseMenuOpenChange(open: boolean) {
  closeMenuOpen.value = open;
  if (!open) pendingCloseJob.value = null;
}

function chooseCloseReason(reason: ClosedReason) {
  if (pendingCloseJob.value) updateJobApplicationStatus(pendingCloseJob.value.id, reason);
  closeMenuOpen.value = false;
  pendingCloseJob.value = null;
}
</script>
