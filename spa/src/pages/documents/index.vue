<template>
  <!-- Canvas "Documents": title and tabs (with counts) on one line, no header bar -->
  <Tabs v-model="tab" class="gap-5 px-4 pt-4 pb-12 lg:gap-6 lg:px-11 lg:pt-7">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-4">
      <h1 class="mr-auto text-[28px] font-extrabold whitespace-nowrap lg:mr-0 lg:text-[34px]">Documents</h1>
      <TabsList aria-label="Documents" class="order-last w-full lg:order-none lg:w-auto">
        <TabsTrigger value="resumes" class="max-lg:flex-1">Resumes<template v-if="resumeCount"> · {{ resumeCount }}</template></TabsTrigger>
        <TabsTrigger value="cover-letters" class="max-lg:flex-1">
          Cover letters<template v-if="coverLetterCount"> · {{ coverLetterCount }}</template>
        </TabsTrigger>
      </TabsList>
      <div class="hidden grow lg:block">
        <AppSearch v-if="tab === 'cover-letters'" v-model="search" class="ml-auto" />
      </div>
      <!-- Phones: a round icon button, as on the canvas -->
      <UploadResumeButton v-if="tab === 'resumes'" class="max-lg:size-11 max-lg:rounded-full max-lg:px-0" aria-label="Upload resume">
        <span class="hidden lg:inline">Upload resume</span>
      </UploadResumeButton>
      <Button
        v-else
        class="max-lg:size-11 max-lg:rounded-full max-lg:px-0"
        aria-label="Write a cover letter"
        @click="$router.replace({ query: { ...$route.query, 'dialog-name': 'generate-cover-letter' } })"
      >
        <PhSparkle />
        <span class="hidden lg:inline">Write a cover letter</span>
      </Button>
    </div>

    <TabsContent value="resumes">
      <ResumesList />
    </TabsContent>
    <TabsContent value="cover-letters">
      <CoverLettersList />
    </TabsContent>
  </Tabs>
</template>

<script setup lang="ts">
import { computed, provide, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PhSparkle } from "@phosphor-icons/vue";
import { SearchSymbol } from "@/constants/symbols.ts";
import AppSearch from "@/components/AppSearch.vue";
import ResumesList from "@/components/ResumesList.vue";
import CoverLettersList from "@/components/CoverLettersList.vue";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCoverLetters } from "@/composables/useCoverLetters";
import { useResumes } from "@/composables/useResumes";

type DocumentsTab = "resumes" | "cover-letters";

const route = useRoute();
const router = useRouter();

// The tab lives in the url (?tab=) so links and redirects can open either one
const tab = computed<DocumentsTab>({
  get: () => (route.query.tab === "cover-letters" ? "cover-letters" : "resumes"),
  set: (value) => router.replace({ query: { ...route.query, tab: value } }),
});

const search = ref("");

const { data: resumes } = useResumes();
const { coverLetters } = useCoverLetters();
const resumeCount = computed(() => resumes.value?.length ?? 0);
const coverLetterCount = computed(() => coverLetters.value?.length ?? 0);

provide(
  SearchSymbol,
  computed(() => search.value.trim().toLowerCase()),
);
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
