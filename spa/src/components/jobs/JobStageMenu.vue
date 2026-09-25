<!-- Move a job to another stage, or close it with a reason -->
<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="ghost" size="icon-sm" :aria-label="`Move ${job.companyName}`">
          <PhDotsThree :size="18" weight="bold" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-52">
      <DropdownMenuLabel class="text-muted-foreground text-xs font-medium">Move to</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="stage in OPEN_STAGES"
        :key="stage"
        :disabled="stage === currentStage"
        @select="moveTo(stage)"
      >
        {{ STAGE_LABELS[stage] }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel class="text-muted-foreground text-xs font-medium">Close as</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="reason in CLOSED_REASONS"
        :key="reason"
        :disabled="reason === job.status"
        @select="updateJobApplicationStatus(job.id, reason)"
      >
        {{ CLOSED_REASON_LABELS[reason] }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhDotsThree } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import {
  CLOSED_REASON_LABELS,
  CLOSED_REASONS,
  OPEN_STAGES,
  STAGE_LABELS,
  stageOf,
  statusForStage,
  type OpenStage,
} from "@/lib/stages";
import type { JobApplication } from "@/types";

const { job } = defineProps<{ job: JobApplication }>();

const { updateJobApplicationStatus, markApplied } = useUpdateJobApplicationStatus();

const currentStage = computed(() => stageOf(job.status));

function moveTo(stage: OpenStage) {
  // Saved -> Applied is "I applied": it also sets the follow-up date
  if (stage === "applied" && job.status === "draft") return markApplied(job.id);
  return updateJobApplicationStatus(job.id, statusForStage(stage));
}
</script>
