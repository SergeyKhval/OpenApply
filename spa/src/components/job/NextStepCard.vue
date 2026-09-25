<!-- The one thing to do next for this job: an upcoming interview, a follow-up,
     or applying. Feeds the same data as Next up on the Jobs page. -->
<template>
  <section
    aria-label="Next step"
    class="flex flex-col gap-4 rounded-card bg-secondary p-5 sm:flex-row sm:items-center"
  >
    <div class="flex grow items-center gap-4">
      <span class="grid size-12 shrink-0 place-items-center rounded-full bg-card text-secondary-foreground">
        <PhCalendarBlank v-if="step.kind === 'interview'" :size="22" />
        <PhPaperPlaneTilt v-else-if="step.kind === 'follow-up' || step.kind === 'no-follow-up'" :size="22" />
        <PhCheckCircle v-else :size="22" />
      </span>
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-[13px] font-bold text-secondary-foreground">Next step</span>
        <span class="text-[17px] font-bold">{{ step.title }}</span>
        <span v-if="step.detail" class="text-[15px] text-soft-foreground">{{ step.detail }}</span>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 sm:shrink-0">
      <template v-if="step.kind === 'follow-up'">
        <Button variant="outline" size="sm" @click="emit('draft-follow-up')">Draft follow-up</Button>
        <Button variant="ghost" size="sm" @click="snoozeFollowUp(job.id)">Snooze</Button>
        <Button size="sm" @click="clearFollowUp(job.id)"><PhCheck />Done</Button>
      </template>
      <Button v-else-if="step.kind === 'no-follow-up'" variant="outline" size="sm" @click="scheduleFollowUp(job.id)">
        Remind me in a week
      </Button>
      <Button v-else-if="step.kind === 'apply'" size="sm" @click="markApplied(job.id)"><PhCheck />I applied</Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhCalendarBlank, PhCheck, PhCheckCircle, PhPaperPlaneTilt } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import { daysAgoLabel, toJsDate } from "@/lib/jobDates";
import { stageOf } from "@/lib/stages";
import type { TimelineEntry } from "@/lib/timeline";
import type { JobApplication } from "@/types";

const { job, upcomingInterview, now } = defineProps<{
  job: JobApplication;
  upcomingInterview: Extract<TimelineEntry, { kind: "interview" }> | null;
  now: Date;
}>();
const emit = defineEmits<{ (event: "draft-follow-up"): void }>();

const { markApplied, scheduleFollowUp, snoozeFollowUp, clearFollowUp } = useUpdateJobApplicationStatus();

const formatDate = (date: Date) =>
  date.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const step = computed(() => {
  const stage = stageOf(job.status);
  if (upcomingInterview) {
    return { kind: "interview" as const, title: upcomingInterview.title, detail: formatDate(upcomingInterview.date) };
  }
  if (stage === "saved") {
    return { kind: "apply" as const, title: "Apply, or let it go", detail: "Mark it applied and we'll remind you to follow up in a week." };
  }
  if (stage === "closed") {
    return { kind: "closed" as const, title: "Closed", detail: "Nothing left to do here. Reopen it from the stage control if that changes." };
  }
  const dueAt = toJsDate(job.followUpAt);
  if (dueAt) {
    const due = dueAt <= now;
    return {
      kind: "follow-up" as const,
      title: `Follow up with ${job.companyName}`,
      detail: due ? `Due ${daysAgoLabel(dueAt, now)}` : `On ${dueAt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`,
    };
  }
  return { kind: "no-follow-up" as const, title: "No follow-up set", detail: "We can remind you to check in." };
});
</script>
