<!-- Phones: one job in the list by stage (canvas "Jobs", mobile). The stage pill
     is the stage menu; saved jobs get "I applied" instead. The whole row opens
     the job. -->
<template>
  <article
    class="relative flex flex-col gap-2 rounded-card border border-transparent bg-card p-4 shadow-card dark:border-border"
  >
    <div class="flex items-center gap-3">
      <CompanyAvatar :company-name="job.companyName" :logo-url="job.companyLogoUrl" class="shrink-0" />
      <div class="flex min-w-0 grow flex-col">
        <RouterLink
          :to="`/jobs/${job.id}`"
          class="truncate font-bold leading-snug text-foreground after:absolute after:inset-0 after:rounded-card"
        >
          {{ job.companyName }}
        </RouterLink>
        <span class="truncate text-sm leading-snug text-soft-foreground">{{ job.position }}</span>
      </div>
      <!-- Above the row's full-size link so they stay clickable -->
      <div class="relative z-10 shrink-0">
        <Button v-if="job.status === 'draft'" variant="outline" size="sm" @click="markApplied(job.id)">
          <PhCheck />I applied
        </Button>
        <JobStageMenu v-else :job="job">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full"
            :aria-label="`${STAGE_LABELS[stage]}. Move ${job.companyName}`"
          >
            <StageBadge :stage="stage">
              {{ STAGE_LABELS[stage] }}
              <PhCaretDown :size="12" aria-hidden="true" />
            </StageBadge>
          </button>
        </JobStageMenu>
      </div>
    </div>

    <p class="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
      <span>{{ stageSinceLabel(job, now) }}</span>
      <span
        v-if="followUp"
        class="inline-flex items-center gap-1"
        :class="followUp.due && 'font-semibold text-secondary-foreground'"
      >
        <PhPaperPlaneTilt v-if="followUp.due" :size="13" aria-hidden="true" />
        <template v-else>·</template>
        {{ followUp.text }}
      </span>
      <span v-else-if="extra">· {{ extra }}</span>
    </p>
    <PostingSignsBadge v-if="signs.length" :lines="signs" class="relative z-10 self-start" />
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhCaretDown, PhCheck, PhPaperPlaneTilt } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import CompanyAvatar from "@/components/jobs/CompanyAvatar.vue";
import JobStageMenu from "@/components/jobs/JobStageMenu.vue";
import PostingSignsBadge from "@/components/jobs/PostingSignsBadge.vue";
import StageBadge from "@/components/jobs/StageBadge.vue";
import { useJobSignals } from "@/composables/useJobSignals";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import { followUpLabel, stageSinceLabel } from "@/lib/jobDates";
import { STAGE_LABELS, stageOf } from "@/lib/stages";
import type { JobApplication } from "@/types";

const { job, now } = defineProps<{ job: JobApplication; now: Date }>();

const { markApplied } = useUpdateJobApplicationStatus();

const stage = computed(() => stageOf(job.status));
const followUp = computed(() => followUpLabel(job, now));
const signs = useJobSignals(() => job, () => now);

// One more fact when there's no follow-up: the match, else the salary
const extra = computed(() => {
  const score = job.toolMatch?.matchScore;
  if (score !== undefined) return `Match ${score}`;
  return job.salary ?? "";
});
</script>
