<!-- Sidebar: AI checks left this month, links to Settings > Plan and AI usage -->
<template>
  <RouterLink
    to="/settings/plan"
    class="flex flex-col gap-2 rounded-2xl px-3 py-2.5 hover:bg-muted"
    :aria-label="`${label}. Plan and AI usage`"
  >
    <span class="flex items-baseline justify-between gap-2 text-[13px]">
      <span class="flex items-center gap-1.5 font-semibold">
        <PhSparkle class="text-secondary-foreground" :size="15" />
        AI checks
      </span>
      <span class="text-soft-foreground">
        <b class="font-semibold text-foreground">{{ allowance.remaining }}</b> of {{ allowance.limit }} left
      </span>
    </span>
    <span class="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <span
        class="block h-full rounded-full"
        :class="allowance.remaining === 0 ? 'bg-destructive' : 'bg-primary'"
        :style="{ width: `${leftPercent}%` }"
      />
    </span>
    <span v-if="allowance.bonusChecks > 0" class="text-xs text-muted-foreground">
      + {{ allowance.bonusChecks }} bonus
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhSparkle } from "@phosphor-icons/vue";
import type { AllowanceState } from "@/lib/aiAllowance";

type AllowanceMeterProps = {
  allowance: AllowanceState;
};

const { allowance } = defineProps<AllowanceMeterProps>();

const leftPercent = computed(() => Math.round((allowance.remaining / allowance.limit) * 100));
const label = computed(() => `${allowance.remaining} of ${allowance.limit} AI checks left this month`);
</script>
