<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'bg-card text-card-foreground flex flex-col gap-3 rounded-card border border-transparent py-5 shadow-card dark:border-border',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
