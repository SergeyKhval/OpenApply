<script setup lang="ts">
import type { HTMLAttributes } from "vue"

import { cn } from "@/lib/utils"

const { class: className } = defineProps<{
  class?: HTMLAttributes["class"]
}>()

defineExpose({ className })
</script>

<template>
  <p
    data-slot="empty-description"
    :class="cn('text-sm text-muted-foreground', className)"
  >
    <slot />
  </p>
</template>
