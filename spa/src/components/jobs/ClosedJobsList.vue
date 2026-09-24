<!-- Closed jobs, grouped by reason. Reopen one from its card menu. -->
<template>
  <div>
    <PageHeader>
      <RouterLink
        to="/jobs"
        class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <PhCaretLeft />
        Jobs
      </RouterLink>
      <h1 class="text-2xl font-extrabold whitespace-nowrap">Closed</h1>
    </PageHeader>

    <div class="flex flex-col gap-8 px-4 pb-10 lg:px-6">
      <section v-for="group in groups" :key="group.reason" class="flex flex-col gap-3">
        <h2 class="flex items-baseline gap-2 text-lg font-bold">
          {{ CLOSED_REASON_LABELS[group.reason] }}
          <span class="font-sans text-[15px] font-normal text-muted-foreground">{{ group.jobs.length }}</span>
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <JobCard v-for="job in group.jobs" :key="job.id" :job="job" :now="now" />
        </div>
      </section>

      <Empty v-if="!groups.length" class="py-12">
        <EmptyIcon>
          <PhArchive :size="32" />
        </EmptyIcon>
        <div class="space-y-2">
          <EmptyTitle>Nothing closed yet</EmptyTitle>
          <EmptyDescription>
            Jobs you close as hired, rejected, withdrew or archived appear here.
          </EmptyDescription>
        </div>
      </Empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhArchive, PhCaretLeft } from "@phosphor-icons/vue";
import PageHeader from "@/components/PageHeader.vue";
import JobCard from "@/components/jobs/JobCard.vue";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "@/components/ui/empty";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { CLOSED_REASON_LABELS, CLOSED_REASONS, closedReason } from "@/lib/stages";

const { now } = defineProps<{ now: Date }>();

const { jobApplications } = useJobApplicationsData();

const groups = computed(() =>
  CLOSED_REASONS.map((reason) => ({
    reason,
    jobs: (jobApplications.value ?? []).filter((job) => closedReason(job.status) === reason),
  })).filter((group) => group.jobs.length),
);
</script>
