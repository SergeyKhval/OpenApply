<template>
  <!-- /jobs?stage=closed: closed jobs (also where old /dashboard/archive lands) -->
  <ClosedJobsList v-if="showClosed" :now="now" />
  <div v-else class="flex h-full flex-col">
    <PageHeader>
      <div class="flex w-full min-w-0 items-center gap-3">
        <div class="mr-auto flex min-w-0 flex-col">
          <span class="hidden text-sm text-muted-foreground lg:block">{{ todayLabel }}</span>
          <h1 class="truncate text-2xl font-extrabold lg:text-[30px]">{{ greeting }}</h1>
        </div>
        <template v-if="hasJobs">
          <AppSearch v-model="search" class="max-w-72" />
          <Tabs v-model="view" class="hidden lg:flex">
            <TabsList aria-label="View">
              <TabsTrigger value="board"><PhKanban />Board</TabsTrigger>
              <TabsTrigger value="list"><PhListBullets />List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button class="hidden md:inline-flex" @click="openAddJob">
            <PhPlus />
            Add job
          </Button>
        </template>
      </div>
    </PageHeader>

    <div class="flex grow flex-col gap-7 px-4 pb-28 lg:px-6 lg:pb-10">
      <template v-if="hasJobs">
        <NextUpStrip :items="nextUp" :jobs="jobApplications" :now="now" />
        <p v-if="search && !filteredJobs.length" class="text-muted-foreground">
          No jobs match "{{ search }}".
        </p>
        <JobsMobileList class="lg:hidden" :jobs="filteredJobs" :now="now" />
        <div class="hidden lg:block">
          <JobsBoard v-if="view === 'board'" :jobs="filteredJobs" :now="now" />
          <JobsList v-else :jobs="filteredJobs" :now="now" />
        </div>
      </template>
      <FirstJobApplicationPrompt v-else-if="!isLoading" class="py-6" />
    </div>

    <Button
      v-if="hasJobs"
      size="icon"
      class="fixed right-5 bottom-[calc(5.5rem+max(0.5rem,env(safe-area-inset-bottom)))] z-20 size-15 shadow-pop md:hidden"
      aria-label="Add job"
      @click="openAddJob"
    >
      <PhPlus :size="26" weight="bold" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCurrentUser } from "vuefire";
import { useIntervalFn } from "@vueuse/core";
import { PhKanban, PhListBullets, PhPlus } from "@phosphor-icons/vue";
import PageHeader from "@/components/PageHeader.vue";
import AppSearch from "@/components/AppSearch.vue";
import FirstJobApplicationPrompt from "@/components/FirstJobApplicationPrompt.vue";
import ClosedJobsList from "@/components/jobs/ClosedJobsList.vue";
import JobsBoard from "@/components/jobs/JobsBoard.vue";
import JobsList from "@/components/jobs/JobsList.vue";
import JobsMobileList from "@/components/jobs/JobsMobileList.vue";
import NextUpStrip from "@/components/jobs/NextUpStrip.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { useNextUp } from "@/composables/useNextUp";

type JobsView = "board" | "list";
const VIEW_STORAGE_KEY = "oa-jobs-view";

const route = useRoute();
const router = useRouter();
const user = useCurrentUser();
const { jobApplications, isLoading } = useJobApplicationsData();
const { items: nextUp } = useNextUp();

// Relative labels ("today", "Follow up Mon") stay right if the tab stays open
const now = ref(new Date());
useIntervalFn(() => (now.value = new Date()), 60_000);

const showClosed = computed(() => route.query.stage === "closed");
const hasJobs = computed(() => (jobApplications.value?.length ?? 0) > 0);

const greeting = computed(() => {
  const hour = now.value.getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.value?.displayName?.trim().split(/\s+/)[0];
  return firstName ? `${part}, ${firstName}` : part;
});
const todayLabel = computed(() =>
  now.value.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
);

// Board is the default; List is remembered per browser and linkable (?view=list)
const readStoredView = (): JobsView | null => {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "list" || stored === "board" ? stored : null;
  } catch {
    return null;
  }
};
const view = computed<JobsView>({
  get: () => (route.query.view === "list" ? "list" : route.query.view === "board" ? "board" : (readStoredView() ?? "board")),
  set: (value) => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, value);
    } catch {
      // storage blocked: the query param still carries it
    }
    router.replace({ query: { ...route.query, view: value } });
  },
});

const search = ref("");
const filteredJobs = computed(() => {
  const term = search.value.trim().toLowerCase();
  const jobs = jobApplications.value ?? [];
  if (!term) return jobs;
  return jobs.filter(
    (job) => job.companyName.toLowerCase().includes(term) || job.position.toLowerCase().includes(term),
  );
});
watch(showClosed, () => (search.value = ""));

function openAddJob() {
  router.replace({ query: { ...route.query, "dialog-name": "add-job-application" } });
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
