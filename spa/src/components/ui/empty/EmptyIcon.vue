<script setup lang="ts">
import type { HTMLAttributes } from "vue"

import { cn } from "@/lib/utils"

const { class: className } = defineProps<{
  class?: HTMLAttributes["class"]
}>()

defineExpose({ className })
</script>

<template>
  <div
    data-slot="empty-icon"
    :class="cn(
      'flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground',
      className,
    )"
  >
    <slot />
  </div>
</template>
