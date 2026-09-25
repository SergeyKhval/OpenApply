<template>
  <div class="flex flex-col gap-0.5 text-sm text-muted-foreground">
    <p>
      <span class="font-semibold text-foreground">
        {{ allowance.remaining }} of {{ allowance.limit }}
        {{ allowance.plan === "pro" ? "AI checks" : "free AI checks" }} left this month.
      </span>
      They reset on {{ resetDate }}.
    </p>
    <p v-if="allowance.bonusChecks > 0">
      + {{ allowance.bonusChecks }} bonus
      {{ allowance.bonusChecks === 1 ? "check" : "checks" }}, used after your
      monthly ones
    </p>
    <p v-if="isNearFairUseLimit">
      You're close to this month's fair-use limit.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PRO_WARNING_THRESHOLD, type AllowanceState } from "@/lib/aiAllowance";

type AiChecksLeftProps = {
  allowance: AllowanceState;
};

const { allowance } = defineProps<AiChecksLeftProps>();

const isNearFairUseLimit = computed(
  () => allowance.plan === "pro" && allowance.used >= PRO_WARNING_THRESHOLD,
);
const resetDate = computed(() =>
  allowance.resetsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }),
);
</script>
