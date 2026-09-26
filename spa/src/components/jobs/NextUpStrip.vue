<!-- What needs doing this week: follow-ups due, interviews, saved jobs going stale -->
<template>
  <section v-if="items.length" aria-labelledby="next-up-heading" class="flex flex-col gap-3.5">
    <div class="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
      <h2 id="next-up-heading" class="text-[22px] font-bold">
        {{ items.length === 1 ? "1 thing" : `${items.length} things` }} for this week
      </h2>
      <p v-if="appliedThisWeek > 0" class="text-[15px] text-muted-foreground">
        You applied to {{ appliedThisWeek === 1 ? "1 job" : `${appliedThisWeek} jobs` }} this week. Good pace.
      </p>
    </div>

    <ul class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="(item, index) in visibleItems"
        :key="`${item.kind}-${item.job.id}-${index}`"
        class="flex flex-col gap-2.5 rounded-card border border-transparent bg-card p-4 shadow-card dark:border-border"
      >
        <div class="flex items-center gap-2.5">
          <span class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <PhPaperPlaneTilt v-if="item.kind === 'follow-up'" :size="18" />
            <PhCalendarBlank v-else-if="item.kind === 'interview'" :size="18" />
            <PhClock v-else :size="18" />
          </span>
          <span
            class="text-[13.5px] font-bold"
            :class="item.kind === 'follow-up' ? 'text-secondary-foreground' : 'text-muted-foreground'"
          >
            {{ nextUpEyebrow(item) }}
          </span>
        </div>

        <p class="text-base">
          <template v-if="item.kind === 'follow-up'">Follow up with <b>{{ item.job.companyName }}</b></template>
          <template v-else-if="item.kind === 'interview'"><b>{{ item.interview.name }}, {{ time(item.interview.conductedAt) }}</b> · {{ item.job.companyName }}</template>
          <template v-else><b>{{ item.job.companyName }}</b> · {{ item.job.position }}</template>
        </p>
        <p class="-mt-1.5 text-sm text-muted-foreground">{{ detail(item) }}</p>

        <div class="flex flex-wrap gap-1">
          <template v-if="item.kind === 'follow-up'">
            <Button variant="secondary" size="sm" @click="act(item, 'draft')">Draft follow-up</Button>
            <Button variant="ghost" size="sm" @click="act(item, 'done')">Done</Button>
            <Button variant="ghost" size="sm" @click="act(item, 'snooze')">Snooze</Button>
          </template>
          <Button v-else-if="item.kind === 'interview'" variant="outline" size="sm" as-child>
            <RouterLink :to="`/jobs/${item.job.id}`" @click="act(item, 'open')">Open job</RouterLink>
          </Button>
          <template v-else>
            <Button variant="outline" size="sm" @click="act(item, 'applied')"><PhCheck />I applied</Button>
            <Button variant="ghost" size="sm" @click="act(item, 'let_go')">Let it go</Button>
          </template>
        </div>
      </li>
    </ul>

    <Button
      v-if="items.length > COLLAPSED_COUNT && !expanded"
      variant="ghost"
      size="sm"
      class="self-start md:hidden"
      @click="expanded = true"
    >
      Show all {{ items.length }}
    </Button>

    <FollowUpDialog :job="followUpJob" @close="followUpJob = null" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { PhCalendarBlank, PhCheck, PhClock, PhPaperPlaneTilt } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import FollowUpDialog from "@/components/jobs/FollowUpDialog.vue";
import { useUpdateJobApplicationStatus } from "@/composables/useUpdateJobApplicationStatus";
import { daysAgoLabel, toJsDate } from "@/lib/jobDates";
import { nextUpEyebrow, type NextUpItem } from "@/lib/nextUp";
import type { JobApplication } from "@/types";
import { trackEvent } from "@/analytics";

const { items, jobs, now } = defineProps<{ items: NextUpItem[]; jobs: JobApplication[]; now: Date }>();

const { markApplied, snoozeFollowUp, clearFollowUp, updateJobApplicationStatus } =
  useUpdateJobApplicationStatus();

// Phones show two, with a "Show all"
const COLLAPSED_COUNT = 2;
const isWide = useMediaQuery("(min-width: 768px)");
const expanded = ref(false);
const visibleItems = computed(() =>
  isWide.value || expanded.value ? items : items.slice(0, COLLAPSED_COUNT),
);

const followUpJob = shallowRef<JobApplication | null>(null);

type NextUpAction = "draft" | "done" | "snooze" | "open" | "applied" | "let_go";

// Tracked: whether people use Next up is the redesign's riskiest assumption
function act(item: NextUpItem, action: NextUpAction) {
  trackEvent("next_up_action", { kind: item.kind, action });
  if (action === "draft") followUpJob.value = item.job;
  else if (action === "done") clearFollowUp(item.job.id);
  else if (action === "snooze") snoozeFollowUp(item.job.id);
  else if (action === "applied") markApplied(item.job.id);
  else if (action === "let_go") updateJobApplicationStatus(item.job.id, "archived");
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const appliedThisWeek = computed(
  () =>
    jobs.filter((job) => {
      const appliedAt = toJsDate(job.appliedAt);
      return appliedAt && now.getTime() - appliedAt.getTime() < WEEK_MS;
    }).length,
);

const time = (date: Date) => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function detail(item: NextUpItem) {
  if (item.kind === "follow-up") {
    const appliedAt = toJsDate(item.job.appliedAt);
    return appliedAt ? `Applied ${daysAgoLabel(appliedAt, now)}, no reply yet` : item.job.position;
  }
  if (item.kind === "interview") return item.job.position;
  return "Apply, or let it go?";
}
</script>
