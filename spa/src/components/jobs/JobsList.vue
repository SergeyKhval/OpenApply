<!-- List view: one row per open job, sortable by company, stage or date -->
<template>
  <div class="overflow-hidden rounded-card bg-card shadow-card dark:border dark:border-border">
    <table class="w-full text-left text-[15px]">
      <thead class="text-[13px] text-muted-foreground">
        <tr class="border-b border-border">
          <th v-for="column in COLUMNS" :key="column.key" scope="col" class="px-5 py-3 font-semibold">
            <button
              v-if="column.sortable"
              type="button"
              class="inline-flex items-center gap-1 hover:text-foreground"
              :aria-sort="sortKey === column.key ? 'ascending' : 'none'"
              @click="sortKey = column.key"
            >
              {{ column.label }}
              <PhCaretDown v-if="sortKey === column.key" :size="12" />
            </button>
            <span v-else>{{ column.label }}</span>
          </th>
          <th scope="col" class="w-12"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="job in sortedJobs" :key="job.id" class="border-b border-border last:border-0">
          <td class="px-5 py-3">
            <div class="flex items-center gap-3">
              <CompanyAvatar :company-name="job.companyName" :logo-url="job.companyLogoUrl" class="size-8" />
              <RouterLink :to="`/jobs/${job.id}`" class="font-semibold hover:underline">{{ job.companyName }}</RouterLink>
            </div>
          </td>
          <td class="px-5 py-3 text-soft-foreground">{{ job.position }}</td>
          <td class="px-5 py-3"><StageBadge :stage="stageOf(job.status)" /></td>
          <td class="px-5 py-3 text-muted-foreground">{{ stageSinceLabel(job, now) }}</td>
          <td class="px-5 py-3" :class="followUpLabel(job, now)?.due ? 'font-semibold text-secondary-foreground' : 'text-muted-foreground'">
            {{ followUpLabel(job, now)?.text ?? "" }}
          </td>
          <td class="pr-3"><JobStageMenu :job="job" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PhCaretDown } from "@phosphor-icons/vue";
import CompanyAvatar from "@/components/jobs/CompanyAvatar.vue";
import JobStageMenu from "@/components/jobs/JobStageMenu.vue";
import StageBadge from "@/components/jobs/StageBadge.vue";
import { followUpLabel, stageSinceLabel, toJsDate } from "@/lib/jobDates";
import { OPEN_STAGES, stageOf } from "@/lib/stages";
import type { JobApplication } from "@/types";

const { jobs, now } = defineProps<{ jobs: JobApplication[]; now: Date }>();

type SortKey = "company" | "stage" | "updated";
const COLUMNS: { key: SortKey | "role" | "next"; label: string; sortable: boolean }[] = [
  { key: "company", label: "Company", sortable: true },
  { key: "role", label: "Role", sortable: false },
  { key: "stage", label: "Stage", sortable: true },
  { key: "updated", label: "In stage", sortable: true },
  { key: "next", label: "Next step", sortable: false },
];

const sortKey = ref<SortKey | "role" | "next">("stage");

const sortedJobs = computed(() => {
  const open = jobs.filter((job) => stageOf(job.status) !== "closed");
  const time = (job: JobApplication) => toJsDate(job.updatedAt)?.getTime() ?? toJsDate(job.createdAt)?.getTime() ?? 0;
  const stageIndex = (job: JobApplication) => OPEN_STAGES.indexOf(stageOf(job.status) as (typeof OPEN_STAGES)[number]);
  return [...open].sort((a, b) => {
    if (sortKey.value === "company") return a.companyName.localeCompare(b.companyName);
    if (sortKey.value === "updated") return time(b) - time(a);
    return stageIndex(a) - stageIndex(b) || time(b) - time(a);
  });
});
</script>
