<!-- Phones: what needs doing this week as one short list (canvas "Jobs",
     mobile). Each row opens the job, where the next step card has the actions. -->
<template>
  <section
    v-if="items.length"
    aria-labelledby="this-week-heading"
    class="flex flex-col rounded-card border border-transparent bg-card px-4 pt-3.5 pb-1.5 shadow-card dark:border-border"
  >
    <div class="flex items-center justify-between gap-3 pb-1">
      <h2 id="this-week-heading" class="text-[17px] font-bold">This week</h2>
      <button
        v-if="items.length > COLLAPSED_COUNT"
        type="button"
        class="text-sm font-semibold text-secondary-foreground"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? "Less" : `All ${items.length}` }}
      </button>
    </div>

    <ul class="flex flex-col divide-y divide-border">
      <li v-for="(item, index) in visibleItems" :key="`${item.kind}-${item.job.id}-${index}`">
        <RouterLink
          :to="`/jobs/${item.job.id}`"
          class="flex items-center gap-3 py-3"
          @click="trackEvent('next_up_action', { kind: item.kind, action: 'open' })"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <PhPaperPlaneTilt v-if="item.kind === 'follow-up'" :size="18" />
            <PhCalendarBlank v-else-if="item.kind === 'interview'" :size="18" />
            <PhClock v-else :size="18" />
          </span>
          <span class="flex min-w-0 grow flex-col">
            <span
              class="text-[13px] font-semibold"
              :class="item.kind === 'follow-up' ? 'text-secondary-foreground' : 'text-muted-foreground'"
            >
              {{ nextUpEyebrow(item) }}
            </span>
            <span class="text-[15px]">
              <template v-if="item.kind === 'follow-up'">Follow up with <b>{{ item.job.companyName }}</b></template>
              <template v-else-if="item.kind === 'interview'"><b>{{ item.interview.name }}, {{ time(item.interview.conductedAt) }}</b> · {{ item.job.companyName }}</template>
              <template v-else><b>{{ item.job.companyName }}</b> · Apply, or let it go?</template>
            </span>
          </span>
          <PhCaretRight :size="18" class="shrink-0 text-soft-foreground" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PhCalendarBlank, PhCaretRight, PhClock, PhPaperPlaneTilt } from "@phosphor-icons/vue";
import { nextUpEyebrow, type NextUpItem } from "@/lib/nextUp";
import { trackEvent } from "@/analytics";

const { items } = defineProps<{ items: NextUpItem[] }>();

const COLLAPSED_COUNT = 2;
const expanded = ref(false);
const visibleItems = computed(() => (expanded.value ? items : items.slice(0, COLLAPSED_COUNT)));

const time = (date: Date) => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
</script>
