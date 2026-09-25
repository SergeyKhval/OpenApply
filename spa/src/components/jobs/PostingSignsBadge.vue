<!-- Job card: how many posting signals the job page lists (flag job-signals) -->
<template>
  <span
    class="inline-flex items-center gap-1.5 self-start rounded-full bg-signal-soft px-2 py-0.5 text-[12px] font-semibold text-signal-text"
    :title="lines.map((line) => line.text).join('\n')"
  >
    <span
      class="size-1.5 rounded-full"
      :class="lines.some((line) => line.tone === 'red') ? 'bg-destructive' : 'bg-signal'"
      aria-hidden="true"
    />
    {{ lines.length === 1 ? "1 posting signal" : `${lines.length} posting signals` }}
  </span>
</template>

<script setup lang="ts">
import type { SignLine } from "@/lib/jobSignals";

const { lines } = defineProps<{ lines: SignLine[] }>();
</script>
