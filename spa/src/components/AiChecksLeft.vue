<template>
  <div class="rounded-lg border border-dashed border-border p-4 bg-muted/20">
    <p class="text-sm font-medium flex items-center gap-2">
      <PhSparkle class="text-muted-foreground" />
      {{ allowance.remaining }} of {{ allowance.limit }}
      {{ allowance.plan === "pro" ? "AI checks" : "free AI checks" }} left this
      month
    </p>
    <p v-if="allowance.bonusChecks > 0" class="text-xs text-muted-foreground">
      + {{ allowance.bonusChecks }} bonus
      {{ allowance.bonusChecks === 1 ? "check" : "checks" }}, used after your
      monthly ones
    </p>
    <p v-if="isNearFairUseLimit" class="text-xs text-muted-foreground">
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
