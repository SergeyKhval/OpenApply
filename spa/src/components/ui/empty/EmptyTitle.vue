<script setup lang="ts">
import type { HTMLAttributes } from "vue"

import { cn } from "@/lib/utils"

const { class: className } = defineProps<{
  class?: HTMLAttributes["class"]
}>()

defineExpose({ className })
</script>

<template>
  <h3 data-slot="empty-title" :class="cn('text-lg font-semibold', className)">
    <slot />
  </h3>
</template>
