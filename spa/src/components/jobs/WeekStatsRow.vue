<!-- Compact weekly counts on the Jobs page: applied, interviews, offers -->
<template>
  <p v-if="visible" class="text-[15px] text-muted-foreground">{{ summary }}</p>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { computeWeekStats, formatWeekStatsRow, shouldShowWeekStats } from "@/lib/weekStats";
import type { JobApplication } from "@/types";

const { jobs, now } = defineProps<{ jobs: JobApplication[]; now: Date }>();

const visible = computed(() => shouldShowWeekStats(jobs.length));
const summary = computed(() => formatWeekStatsRow(computeWeekStats(jobs, now)));
</script>
