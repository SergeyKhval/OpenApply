<template>
  <!-- First run (canvas "First run"): no header bar, the one action centered on the page -->
  <div v-if="isFirstRun" class="flex min-h-full flex-col px-4 pt-4 pb-28 lg:px-6 lg:pb-10">
    <h1 class="text-[28px] font-extrabold lg:sr-only">Jobs</h1>
    <FirstJobApplicationPrompt class="my-auto py-10" />
  </div>
  <!-- /jobs?stage=closed: closed jobs (also where old /dashboard/archive lands) -->
  <ClosedJobsList v-else-if="showClosed" :now="now" />
  <div v-else class="flex h-full flex-col">
    <!-- Phones (canvas "Jobs", mobile): short date, "Jobs" and a search button, no rule -->
    <PageHeader class="max-lg:h-auto max-lg:border-transparent max-lg:pt-4 max-lg:pb-2">
      <div class="flex w-full min-w-0 items-center gap-3">
        <div class="mr-auto flex min-w-0 flex-col">
          <span class="text-[13px] text-muted-foreground lg:hidden">{{ shortDateLabel }}</span>
          <span class="hidden text-sm text-muted-foreground lg:block">{{ todayLabel }}</span>
          <h1 class="truncate text-[28px] font-extrabold lg:text-[30px]">
            <span class="lg:hidden">Jobs</span><span class="hidden lg:inline">{{ greeting }}</span>
          </h1>
        </div>
        <template v-if="hasJobs">
          <Button
            variant="outline"
            size="icon"
            class="size-11 lg:hidden"
            :aria-label="isSearchOpen ? 'Close search' : 'Search jobs'"
            :aria-expanded="isSearchOpen"
            @click="toggleSearch"
          >
            <PhX v-if="isSearchOpen" />
            <PhMagnifyingGlass v-else />
          </Button>
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

    <div class="flex grow flex-col gap-5 px-4 pb-28 lg:gap-7 lg:px-6 lg:pb-10">
      <template v-if="hasJobs">
        <div v-if="isSearchOpen" class="relative lg:hidden">
          <Label for="jobs-search" class="sr-only">Search jobs</Label>
          <PhMagnifyingGlass :size="18" class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-soft-foreground" aria-hidden="true" />
          <Input id="jobs-search" ref="searchInput" v-model="search" placeholder="Company or role" class="h-11 pl-11" />
        </div>
        <WeekStatsRow class="hidden lg:block" :jobs="jobApplications" :now="now" />
        <NextUpCompact class="lg:hidden" :items="nextUp" />
        <NextUpStrip class="hidden lg:flex" :items="nextUp" :jobs="jobApplications" :now="now" />
        <p v-if="search && !filteredJobs.length" class="text-muted-foreground">
          No jobs match "{{ search }}".
        </p>
        <JobsMobileList class="lg:hidden" :jobs="filteredJobs" :now="now" />
        <div class="hidden lg:block">
          <JobsBoard v-if="view === 'board'" :jobs="filteredJobs" :now="now" />
          <JobsList v-else :jobs="filteredJobs" :now="now" />
        </div>
      </template>
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
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCurrentUser } from "vuefire";
import { useIntervalFn } from "@vueuse/core";
import { PhKanban, PhListBullets, PhMagnifyingGlass, PhPlus, PhX } from "@phosphor-icons/vue";
import PageHeader from "@/components/PageHeader.vue";
import AppSearch from "@/components/AppSearch.vue";
import FirstJobApplicationPrompt from "@/components/FirstJobApplicationPrompt.vue";
import ClosedJobsList from "@/components/jobs/ClosedJobsList.vue";
import JobsBoard from "@/components/jobs/JobsBoard.vue";
import JobsList from "@/components/jobs/JobsList.vue";
import JobsMobileList from "@/components/jobs/JobsMobileList.vue";
import NextUpCompact from "@/components/jobs/NextUpCompact.vue";
import NextUpStrip from "@/components/jobs/NextUpStrip.vue";
import WeekStatsRow from "@/components/jobs/WeekStatsRow.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
const isFirstRun = computed(() => !showClosed.value && !isLoading.value && !hasJobs.value);

const greeting = computed(() => {
  const hour = now.value.getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.value?.displayName?.trim().split(/\s+/)[0];
  return firstName ? `${part}, ${firstName}` : part;
});
// "Wed 25 Sep" over "Jobs" on phones
const shortDateLabel = computed(() =>
  now.value.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
);
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

// Phones: the search box opens under the header
const isSearchOpen = ref(false);
const searchInput = ref<InstanceType<typeof Input> | null>(null);
async function toggleSearch() {
  isSearchOpen.value = !isSearchOpen.value;
  if (!isSearchOpen.value) {
    search.value = "";
    return;
  }
  await nextTick();
  (searchInput.value?.$el as HTMLInputElement | undefined)?.focus?.();
}

function openAddJob() {
  router.replace({ query: { ...route.query, "dialog-name": "add-job-application" } });
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
