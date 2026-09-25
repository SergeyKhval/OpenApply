<!-- Shown in place of an AI action once the month's checks are used up -->
<template>
  <div class="flex flex-col gap-4">
    <template v-if="allowance.plan === 'free'">
      <div class="flex flex-col gap-1.5">
        <h3 class="text-xl font-extrabold">You've used your {{ allowance.limit }} free AI checks this month</h3>
        <p class="text-[15px] text-soft-foreground">
          They reset on <b class="font-semibold text-foreground">{{ resetDate }}</b>. Tracking, reminders and
          everything else keep working.
        </p>
      </div>
      <section class="flex flex-col gap-2.5 rounded-card bg-secondary/60 p-5" aria-label="Pro plan">
        <div class="flex items-baseline justify-between gap-3">
          <h4 class="flex items-center gap-2 text-[17px] font-extrabold">
            Pro
            <Badge v-if="proAvailable === false" variant="outline" class="bg-card">Coming soon</Badge>
          </h4>
          <span class="font-display text-lg font-extrabold">$9<span class="font-sans text-sm font-medium text-muted-foreground"> a month</span></span>
        </div>
        <p class="text-[15px] text-soft-foreground">150 AI checks a month instead of 15. Cancel anytime.</p>
        <p v-if="proAvailable === false" class="text-[15px] text-soft-foreground">
          Pro isn't on sale yet, so there's nothing to buy. Your checks come back on {{ resetDate }}.
        </p>
        <div v-else-if="proAvailable" class="flex flex-col items-start gap-1.5 pt-1">
          <Button :disabled="isStartingCheckout" @click="handleUpgrade">
            <Spinner v-if="isStartingCheckout" />
            <PhLightning v-else />
            Upgrade to Pro
          </Button>
          <p class="text-[13px] text-muted-foreground">Taxes may apply.</p>
        </div>
      </section>
    </template>

    <div v-else class="flex flex-col gap-1.5">
      <h3 class="text-xl font-extrabold">You've used this month's {{ allowance.limit }} AI checks</h3>
      <p class="text-[15px] text-soft-foreground">
        They reset on {{ resetDate }}. Need more?
        <a :href="`mailto:${supportEmail}`" class="font-medium text-secondary-foreground hover:underline">Email us</a>.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { PhLightning } from "@phosphor-icons/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trackEvent, type AiLimitSource } from "@/analytics";
import { useProAvailability } from "@/composables/useProAvailability";
import { useProSubscription } from "@/composables/useProSubscription";
import type { AllowanceState } from "@/lib/aiAllowance";

type AiLimitReachedProps = {
  allowance: AllowanceState;
  source: AiLimitSource;
};

const { allowance, source } = defineProps<AiLimitReachedProps>();

const { proAvailable } = useProAvailability();
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
