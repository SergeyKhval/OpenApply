<template>
  <div class="flex flex-col items-start gap-3 rounded-card bg-secondary p-5">
    <template v-if="allowance.plan === 'free'">
      <p class="text-[17px] font-bold">
        You've used your {{ allowance.limit }} free AI checks this month
      </p>
      <p class="text-[15px] text-soft-foreground">
        They reset on {{ resetDate }}. Or go Pro for 150 AI checks a month.
      </p>
      <Button :disabled="isStartingCheckout" @click="handleUpgrade">
        <Spinner v-if="isStartingCheckout" />
        Go Pro, $9/month
      </Button>
      <p class="text-[13px] text-soft-foreground">
        Cancel anytime. Taxes may apply.
      </p>
    </template>

    <template v-else>
      <p class="text-[17px] font-bold">
        You've used this month's {{ allowance.limit }} AI checks
      </p>
      <p class="text-[15px] text-soft-foreground">
        They reset on {{ resetDate }}. Need more?
        <a
          :href="`mailto:${supportEmail}`"
          class="text-primary font-medium hover:underline"
        >Email us</a>.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trackEvent, type AiLimitSource } from "@/analytics";
import { useProSubscription } from "@/composables/useProSubscription";
import type { AllowanceState } from "@/lib/aiAllowance";

type AiLimitReachedProps = {
  allowance: AllowanceState;
  source: AiLimitSource;
};

const { allowance, source } = defineProps<AiLimitReachedProps>();

const { isStartingCheckout, startProCheckout } = useProSubscription();
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL;

const resetDate = computed(() =>
  allowance.resetsAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }),
);

onMounted(() => {
  trackEvent("ai_limit_reached", { plan: allowance.plan, source });
});

function handleUpgrade() {
  trackEvent("upgrade_clicked", { source });
  startProCheckout(source);
}
</script>
