<template>
  <div
    class="rounded-lg border border-dashed border-border p-4 bg-muted/20 flex items-center justify-between"
  >
    <div>
      <p class="text-sm font-medium text-muted-foreground">Available coins</p>
      <p class="text-2xl font-semibold flex items-center gap-1">
        <PhCoins />{{ currentBalance }}
      </p>
      <span class="text-xs text-muted-foreground text-right">
        {{ costText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PhCoins } from "@phosphor-icons/vue";

type AvailableCoinsProps = {
  currentBalance: number;
  costText: string;
};

defineProps<AvailableCoinsProps>();
</script>
