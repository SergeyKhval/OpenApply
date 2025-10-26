<template>
  <div class="grid gap-4 md:grid-cols-3">
    <CreditsPriceCard
      v-for="pack in CREDIT_PACKS"
      :key="pack.id"
      :price="pack.price"
      :credits="pack.credits"
      :discount="pack.discount"
      :loading="loading"
      @purchase="emit('purchase', pack.id)"
    />

    <div class="text-muted-foreground text-sm md:col-span-3">
      No subscriptions. No hidden fees. Pay-as-you-go, buy coins
      only when you need them.
      <ul class="list-disc list-inside">
        <li>One-time purchases — no automatic renewals</li>
        <li>Instant credit delivery to your account</li>
        <li>
          Secure checkout with
          <a
            href="https://stripe.com"
            target="_blank"
            class="text-primary underline hover:no-underline"
          >Stripe</a
          >
        </li>
        <li>Local taxes may apply</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import CreditsPriceCard from "@/components/CreditsPriceCard.vue";
import { CREDIT_PACKS } from "@/constants/creditPacks.ts";

type CreditPackOptionsProps = {
  loading: boolean;
};

type CreditPackOptionsEmits = {
  (event: "purchase", priceId: string): void;
};

const { loading = false } = defineProps<CreditPackOptionsProps>();
const emit = defineEmits<CreditPackOptionsEmits>();
</script>
