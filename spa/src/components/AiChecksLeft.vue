<template>
  <div class="flex flex-col gap-0.5 rounded-card bg-muted px-4 py-3">
    <p class="flex items-center gap-2 text-[15px] font-semibold">
      <PhSparkle class="text-secondary-foreground" />
      {{ allowance.remaining }} of {{ allowance.limit }}
      {{ allowance.plan === "pro" ? "AI checks" : "free AI checks" }} left this
      month
    </p>
    <p v-if="allowance.bonusChecks > 0" class="text-[13px] text-soft-foreground">
      + {{ allowance.bonusChecks }} bonus
      {{ allowance.bonusChecks === 1 ? "check" : "checks" }}, used after your
      monthly ones
    </p>
    <p v-if="isNearFairUseLimit" class="text-[13px] text-soft-foreground">
      You're close to this month's fair-use limit.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhSparkle } from "@phosphor-icons/vue";
import { PRO_WARNING_THRESHOLD, type AllowanceState } from "@/lib/aiAllowance";

type AiChecksLeftProps = {
  allowance: AllowanceState;
};

const { allowance } = defineProps<AiChecksLeftProps>();

const isNearFairUseLimit = computed(
  () => allowance.plan === "pro" && allowance.used >= PRO_WARNING_THRESHOLD,
);
</script>
