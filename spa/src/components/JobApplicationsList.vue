<template>
  <div
    v-if="!applicationsPending && filteredApplications.length"
    class="grid grid-cols-1 gap-4 pr-6 pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <div class="h-full">
      <button
        type="button"
        class="group flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/40 p-6 text-center text-sm font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary"
        @click="
          $router.replace({
            query: { ...$route.query, 'dialog-name': 'add-job-application' },
          })
        "
      >
        <span
          class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"
        >
          <PhPlus :size="24" weight="bold" />
        </span>
        <span class="text-base font-semibold">Add job application</span>
        <span class="text-xs text-muted-foreground">
          Keep track of another opportunity.
        </span>
      </button>
    </div>
    <JobApplicationCard
      v-for="application in filteredApplications"
      :key="application.id"
      :application="application"
    />
  </div>

  <Empty
    v-else-if="!applicationsPending && hasAnyApplications"
    class="py-12 mr-6"
  >
    <EmptyIcon>
      <PhFileDashed :size="32" />
    </EmptyIcon>
    <div class="space-y-2">
      <EmptyTitle>No applications match this filter</EmptyTitle>
      <EmptyDescription>
        Try a different state filter or search term to see more results.
      </EmptyDescription>
    </div>
  </Empty>

  <Empty v-else-if="!applicationsPending" class="py-12 mr-6 lg:mr-0">
    <EmptyIcon>
      <PhFileDashed :size="32" />
    </EmptyIcon>
    <div class="space-y-2">
      <EmptyTitle>No job applications yet</EmptyTitle>
      <EmptyDescription>
        To get started import your existing applications or add a new one.
      </EmptyDescription>
    </div>
    <EmptyAction>
      <RouterLink to="/dashboard/file-import" v-slot="{ navigate }" custom>
        <Button @click="navigate">
          <PhFileCsv />
          Import
        </Button>
      </RouterLink>
      <Button
        @click="
          $router.replace({
            query: { ...$route.query, 'dialog-name': 'add-job-application' },
          })
        "
      >
        <PhPlus />
        Add job application
      </Button>
    </EmptyAction>
  </Empty>

  <div
    v-else
    class="grid grid-cols-1 gap-4 mr-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <div
      v-for="index in 4"
      :key="index"
      class="space-y-4 rounded-xl border border-border bg-muted/40 p-6 h-full"
    >
      <Skeleton class="h-5 w-1/3" />
      <div class="space-y-2">
        <Skeleton class="h-3 w-full" />
        <Skeleton class="h-3 w-3/4" />
        <Skeleton class="h-3 w-2/3" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { PhFileCsv, PhFileDashed, PhPlus } from "@phosphor-icons/vue";
import type { JobStatus } from "@/types";
import JobApplicationCard from "@/components/JobApplicationCard.vue";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyAction,
  EmptyDescription,
  EmptyIcon,
  EmptyTitle,
} from "@/components/ui/empty";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { SearchSymbol } from "@/constants/symbols.ts";
import { Button } from "@/components/ui/button";

type StatusFilter = JobStatus | "all";

const { statusFilter = "all" } = defineProps<{
  statusFilter?: StatusFilter;
}>();

const search = inject(SearchSymbol);

const { jobApplications, isLoading: applicationsPending } =
  useJobApplicationsData();

const ACTIVE_STATUSES: JobStatus[] = [
  "draft",
  "applied",
  "interviewing",
  "offered",
  "hired",
];

const dashboardApplications = computed(() =>
  (jobApplications.value ?? []).filter((application) =>
    ACTIVE_STATUSES.includes(application.status),
  ),
);

const filteredByStatus = computed(() =>
  statusFilter === "all"
    ? dashboardApplications.value
    : jobApplications.value.filter(
        (application) => application.status === statusFilter,
      ),
);

const filteredApplications = computed(() => {
  const searchValue = search?.value ?? "";

  if (!searchValue) {
    return filteredByStatus.value;
  }

  return filteredByStatus.value.filter(
    (application) =>
      application.companyName.toLowerCase().includes(searchValue) ||
      application.position.toLowerCase().includes(searchValue),
  );
});

const hasAnyApplications = computed(
  () => dashboardApplications.value.length > 0,
);
</script>
