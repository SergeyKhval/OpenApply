<template>
  <!-- /jobs?stage=closed: archived jobs (old /dashboard/archive) until the board lands -->
  <ClosedJobsList v-if="showClosed" />
  <div v-else class="h-full flex flex-col">
    <PageHeader>
      <div class="flex items-center w-full gap-6">
        <h2 class="text-2xl font-semibold whitespace-nowrap">Applications</h2>
        <!-- Until the first job exists, the empty state is the only action. -->
        <template v-if="jobApplications.length">
          <div class="grow">
            <AppSearch v-model="search" />
          </div>
          <AddJobApplicationDropdown />
        </template>
      </div>
    </PageHeader>

    <div class="pl-6 lg:px-6 grow flex flex-col gap-4">
      <div v-if="jobApplications.length" class="flex flex-wrap gap-2">
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
        <Button variant="ghost" size="sm" as-child>
          <RouterLink :to="{ path: '/jobs', query: { stage: 'closed' } }">
            <PhArchive />
            Archived
          </RouterLink>
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
import { useRoute } from "vue-router";
import { PhArchive } from "@phosphor-icons/vue";
import ClosedJobsList from "@/components/jobs/ClosedJobsList.vue";
import { SearchSymbol } from "@/constants/symbols.ts";
import PageHeader from "@/components/PageHeader.vue";
import JobApplicationsList from "@/components/JobApplicationsList.vue";
import AppSearch from "@/components/AppSearch.vue";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/types";
import AddJobApplicationDropdown from "@/components/AddJobApplicationDropdown.vue";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";

const { jobApplications } = useJobApplicationsData();
const route = useRoute();
const showClosed = computed(() => route.query.stage === "closed");

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
