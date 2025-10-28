<template>
  <div class="h-full flex flex-col">
    <PageHeader>
      <div class="flex items-center w-full gap-6">
        <h2 class="text-2xl font-semibold whitespace-nowrap">Applications</h2>
        <div class="grow">
          <AppSearch v-model="search" />
        </div>
        <AddJobApplicationDropdown />
      </div>
    </PageHeader>

    <div class="pl-6 lg:px-6 grow flex flex-col gap-4">
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="option in statusOptions"
          :key="option.value"
          :variant="statusFilter === option.value ? 'default' : 'outline'"
          size="sm"
          class="capitalize"
          @click="statusFilter = option.value"
        >
          {{ option.label }}
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <JobApplicationsList :status-filter="statusFilter" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide } from "vue";
import { SearchSymbol } from "@/constants/symbols.ts";
import PageHeader from "@/components/PageHeader.vue";
import JobApplicationsList from "@/components/JobApplicationsList.vue";
import AppSearch from "@/components/AppSearch.vue";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/types";
import AddJobApplicationDropdown from "@/components/AddJobApplicationDropdown.vue";

const search = ref("");
const statusFilter = ref<JobStatus | "all">("all");

const statusOptions = [
  { label: "All", value: "all" as const },
  { label: "Draft", value: "draft" as const },
  { label: "Applied", value: "applied" as const },
  { label: "Interviewing", value: "interviewing" as const },
  { label: "Offered", value: "offered" as const },
  { label: "Hired", value: "hired" as const },
  { label: "Rejected", value: "rejected" as const },
];

provide(
  SearchSymbol,
  computed(() => search.value.trim().toLowerCase()),
);
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
