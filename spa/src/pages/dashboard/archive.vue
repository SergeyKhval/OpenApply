<template>
  <div>
    <PageHeader>
      <h2 class="text-2xl font-semibold text-foreground whitespace-nowrap">
        Archive
      </h2>
      <AppSearch v-model="search" />
    </PageHeader>

    <div
      v-if="filteredApplications.length > 0"
      class="grid md:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pb-6"
    >
      <JobApplicationCard
        v-for="application in filteredApplications"
        :key="application.id"
        :application="application"
      />
    </div>

    <div v-else class="px-6">
      <template v-if="archivedApplications.length === 0">
        <Empty class="py-12">
          <EmptyIcon>
            <PhArchive :size="32" />
          </EmptyIcon>
          <div class="space-y-2">
            <EmptyTitle>Archive is empty</EmptyTitle>
            <EmptyDescription>
              Applications that you archive will appear here
            </EmptyDescription>
          </div>
        </Empty>
      </template>
      <template v-else>
        <EmptyIcon>
          <PhMagnifyingGlass :size="32" />
        </EmptyIcon>
        <div class="space-y-2">
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyDescription> Try adjusting your search terms </EmptyDescription>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { PhArchive, PhMagnifyingGlass } from "@phosphor-icons/vue";
import PageHeader from "@/components/PageHeader.vue";
import JobApplicationCard from "@/components/JobApplicationCard.vue";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import {
  Empty,
  EmptyDescription,
  EmptyIcon,
  EmptyTitle,
} from "@/components/ui/empty";
import AppSearch from "@/components/AppSearch.vue";

const { jobApplications } = useJobApplicationsData();

const archivedApplications = computed(() =>
  (jobApplications.value ?? []).filter(
    (application) => application.status === "archived",
  ),
);

const search = ref("");
const filteredApplications = computed(() => {
  const searchTerm = search.value.trim().toLowerCase();
  if (!searchTerm) return archivedApplications.value;

  return archivedApplications.value.filter(
    (app) =>
      app.companyName.toLowerCase().includes(searchTerm) ||
      app.position.toLowerCase().includes(searchTerm),
  );
});
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
