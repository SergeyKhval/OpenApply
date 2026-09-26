<!-- Stage control: Saved -> Offer as steps, Closed with a reason in a menu.
     Phones get one full-width button that opens the same choices. -->
<template>
  <div>
    <div role="group" aria-label="Stage" class="hidden w-fit gap-0.5 rounded-full bg-muted p-1 sm:inline-flex">
      <button
        v-for="(stage, index) in OPEN_STAGES"
        :key="stage"
        type="button"
        :aria-current="stage === current ? 'step' : undefined"
        class="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14.5px] transition-colors"
        :class="
          stage === current
            ? 'bg-primary font-bold text-primary-foreground'
            : index < currentIndex
              ? 'text-soft-foreground hover:bg-card'
              : 'text-muted-foreground hover:bg-card'
        "
        @click="moveTo(stage)"
      >
        <PhCheck v-if="index < currentIndex" :size="15" weight="bold" />
        {{ STAGE_LABELS[stage] }}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          class="inline-flex h-10 items-center gap-1 rounded-full px-4 text-[14.5px] transition-colors"
          :class="current === 'closed' ? 'bg-stage-closed-soft font-bold text-stage-closed-text' : 'text-muted-foreground hover:bg-card'"
        >
          {{ reason ? `Closed · ${CLOSED_REASON_LABELS[reason]}` : "Closed" }}
          <PhCaretDown :size="14" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            v-for="option in CLOSED_REASONS"
            :key="option"
            :disabled="option === job.status"
            @select="updateJobApplicationStatus(job.id, option)"
          >
            {{ CLOSED_REASON_LABELS[option] }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <JobStageMenu :job="job">
      <button
        type="button"
        class="flex h-13 w-full items-center justify-between rounded-full px-5 text-base font-bold sm:hidden"
        :class="stageBadgeVariants({ stage: current })"
      >
        <span class="flex items-center gap-2">
          Stage: {{ reason ? `Closed · ${CLOSED_REASON_LABELS[reason]}` : STAGE_LABELS[current] }}
        </span>
        <PhCaretDown :size="18" />
      </button>
    </JobStageMenu>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhCaretDown, PhCheck } from "@phosphor-icons/vue";
import { stageBadgeVariants } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import JobStageMenu from "@/components/jobs/JobStageMenu.vue";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import {
  CLOSED_REASON_LABELS,
  CLOSED_REASONS,
  closedReason,
  OPEN_STAGES,
  STAGE_LABELS,
  stageOf,
  type OpenStage,
} from "@/lib/stages";
import type { JobApplication } from "@/types";

const { job } = defineProps<{ job: JobApplication }>();

const { updateJobApplicationStatus, moveToStage } = useUpdateJobApplicationStatus();

const current = computed(() => stageOf(job.status));
const reason = computed(() => closedReason(job.status));
const currentIndex = computed(() =>
  current.value === "closed" ? -1 : OPEN_STAGES.indexOf(current.value),
);

function moveTo(stage: OpenStage) {
  if (stage === current.value) return;
  return moveToStage(job, stage);
}
</script>
