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
    data-slot="empty-action"
    :class="cn('flex flex-wrap items-center justify-center gap-2', className)"
  >
    <slot />
  </div>
</template>
