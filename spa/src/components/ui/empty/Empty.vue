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
    data-slot="empty"
    :class="cn(
      'flex flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-border bg-muted/40 px-10 py-16 text-center',
      className,
    )"
  >
    <slot />
  </div>
</template>
