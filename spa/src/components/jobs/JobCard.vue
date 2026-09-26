<template>
  <article
    class="group relative flex flex-col gap-2.5 rounded-2xl border border-transparent bg-card p-4 shadow-card dark:border-border"
  >
    <div class="flex items-center gap-3">
      <CompanyAvatar :company-name="job.companyName" :logo-url="job.companyLogoUrl" class="shrink-0" />
      <div class="flex min-w-0 grow basis-0 flex-col">
        <RouterLink
          :to="`/jobs/${job.id}`"
          class="font-bold leading-snug break-words text-foreground after:absolute after:inset-0 after:rounded-2xl hover:underline"
        >
          {{ job.companyName }}
        </RouterLink>
        <span class="text-sm leading-snug break-words text-soft-foreground">{{ job.position }}</span>
      </div>
    </div>

    <div class="flex items-end justify-between gap-2">
      <div class="flex min-w-0 flex-col gap-2.5">
        <div class="flex flex-col gap-0.5 text-[13px] text-muted-foreground">
          <span>{{ metaLine }}</span>
          <PostingSignsBadge v-if="signs.length" :lines="signs" class="mt-1" />
          <span
            v-if="followUp"
            class="inline-flex items-center gap-1"
            :class="followUp.due && 'font-semibold text-secondary-foreground'"
          >
            <PhPaperPlaneTilt :size="14" />{{ followUp.text }}
          </span>
        </div>
        <div v-if="job.status === 'draft'" class="relative z-10">
          <Button variant="outline" size="sm" @click="markApplied(job.id)">
            <PhCheck />
            I applied
          </Button>
        </div>
      </div>
      <!-- Above the card's full-size link so it stays clickable -->
      <div
        class="relative z-10 -mr-1.5 -mb-1 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 lg:has-[[data-state=open]]:opacity-100"
      >
        <JobStageMenu :job="job" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhCheck, PhPaperPlaneTilt } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import CompanyAvatar from "@/components/jobs/CompanyAvatar.vue";
import JobStageMenu from "@/components/jobs/JobStageMenu.vue";
import PostingSignsBadge from "@/components/jobs/PostingSignsBadge.vue";
import { useJobSignals } from "@/composables/useJobSignals";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import { followUpLabel, stageSinceLabel } from "@/lib/jobDates";
import type { JobApplication } from "@/types";

const { job, now } = defineProps<{ job: JobApplication; now: Date }>();

const { markApplied } = useUpdateJobApplicationStatus();

const signs = useJobSignals(() => job, () => now);
const followUp = computed(() => followUpLabel(job, now));
const metaLine = computed(() => {
  const score = job.toolMatch?.matchScore;
  const since = stageSinceLabel(job, now);
  const parts = [since, job.salary, score === undefined ? undefined : `Match ${score}`];
  return parts.filter(Boolean).join(" · ");
});
</script>
