<template>
  <SettingsShell>
    <Card>
      <CardHeader class="flex flex-row items-start justify-between gap-3">
        <div class="flex flex-col gap-0.5">
          <CardTitle class="text-[22px] font-extrabold">{{ isPro ? "Pro" : "Free plan" }}</CardTitle>
          <p class="text-sm text-muted-foreground">
            {{ isPro ? proLine ?? "$9 a month" : "Tracking is free forever" }}
          </p>
        </div>
        <Badge :variant="isPastDue ? 'destructive' : 'success'">
          {{ isPastDue ? "Payment failed" : "Current plan" }}
        </Badge>
      </CardHeader>
      <CardContent v-if="allowance" class="flex flex-col gap-3.5">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-[15px] font-semibold">AI checks this month</span>
          <span class="text-[15px]">
            <b class="font-display text-xl">{{ allowance.used }}</b> of {{ allowance.limit }} used
          </span>
        </div>
        <div
          class="h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="AI checks used this month"
          :aria-valuenow="allowance.used"
          aria-valuemin="0"
          :aria-valuemax="allowance.limit"
        >
          <div class="h-full rounded-full bg-primary" :style="{ width: `${usedPercent}%` }" />
        </div>
        <p class="text-sm text-muted-foreground">{{ resetText }}</p>
        <p v-if="allowance.bonusChecks > 0" class="text-sm text-muted-foreground">
          Plus {{ allowance.bonusChecks }} bonus {{ allowance.bonusChecks === 1 ? "check" : "checks" }} from your
          old coins, used after the monthly ones. They don't expire.
        </p>
        <div v-if="hasSubscription">
          <Button variant="outline" size="sm" :disabled="isOpeningPortal" @click="openBillingPortal">
            <Spinner v-if="isOpeningPortal" />
            <PhCreditCard v-else />
            {{ isPro ? "Manage subscription" : "Billing history" }}
          </Button>
        </div>
      </CardContent>
      <CardContent v-else class="flex flex-col gap-3.5">
        <Skeleton class="h-5 w-full" />
        <Skeleton class="h-3 w-full rounded-full" />
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle class="text-[17px]">What uses an AI check</CardTitle></CardHeader>
      <CardContent class="flex flex-col gap-3.5">
        <div class="flex items-center gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <PhSparkle :size="18" />
          </span>
          <span class="text-[15px]">A resume match, or writing or rewriting a cover letter.</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
            <PhCheck :size="18" />
          </span>
          <span class="text-[15px] text-soft-foreground">
            Always free: tracking, reminders, reading job links, the public resume check, import and export.
          </span>
        </div>
      </CardContent>
    </Card>

    <section
      v-if="!isPro"
      class="flex flex-col gap-3 rounded-card border-[1.5px] border-dashed border-input p-6"
      aria-labelledby="pro-plan-title"
    >
      <div class="flex items-baseline justify-between gap-3">
        <h2 id="pro-plan-title" class="flex items-center gap-2 text-[22px] font-extrabold">
          Pro
          <Badge v-if="proAvailable === false" variant="secondary">Coming soon</Badge>
        </h2>
        <span class="font-display text-[22px] font-extrabold">
          $9<span class="font-sans text-sm font-medium text-muted-foreground"> a month</span>
        </span>
      </div>
      <p class="text-[15px] text-soft-foreground">150 AI checks a month, ten times the free plan. Cancel anytime.</p>
      <p v-if="proAvailable === false" class="text-[15px] text-soft-foreground">
        Not on sale yet: payments aren't switched on, so there's nothing to buy today. Your free checks come
        back on the 1st of every month.
      </p>
      <div v-else-if="proAvailable">
        <Button variant="outline" :disabled="isStartingCheckout" @click="upgrade">
          <Spinner v-if="isStartingCheckout" />
          <PhLightning v-else />
          Upgrade to Pro
        </Button>
      </div>
    </section>

    <p class="text-sm text-muted-foreground">
      Rather run it yourself?
      <a
        href="https://github.com/SergeyKhval/OpenApply"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-secondary-foreground underline-offset-2 hover:underline"
      >Self-host with your own API key</a>.
    </p>
  </SettingsShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhCheck, PhCreditCard, PhLightning, PhSparkle } from "@phosphor-icons/vue";
import SettingsShell from "@/components/settings/SettingsShell.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { trackEvent } from "@/analytics";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useAuth } from "@/composables/useAuth";
import { useProAvailability } from "@/composables/useProAvailability";
import { useProSubscription } from "@/composables/useProSubscription";
import { proStatusLine, resetLine } from "@/lib/planStatus";

const { userProfile } = useAuth();
const { allowance } = useAiAllowance();
const { proAvailable } = useProAvailability();
const { isStartingCheckout, isOpeningPortal, startProCheckout, openBillingPortal } = useProSubscription();

const billing = computed(() => userProfile.value?.billingProfile);
const isPro = computed(() => allowance.value?.plan === "pro");
const isPastDue = computed(() => billing.value?.subscriptionStatus === "past_due");
// Anyone with a Stripe subscription (even a lapsed one) can see their invoices.
const hasSubscription = computed(() => !!billing.value?.stripeSubscriptionId);
const proLine = computed(() => proStatusLine(billing.value));

const usedPercent = computed(() =>
  allowance.value ? Math.min(100, Math.round((allowance.value.used / allowance.value.limit) * 100)) : 0,
);
const resetText = computed(() =>
  allowance.value ? resetLine(allowance.value.resetsAt, allowance.value.remaining) : "",
);

function upgrade() {
  trackEvent("upgrade_clicked", { source: "settings_plan" });
  startProCheckout("settings_plan");
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
