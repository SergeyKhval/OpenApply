<template>
  <div>
    <PageHeader>
      <h1 class="text-2xl font-extrabold whitespace-nowrap lg:text-3xl">Documents</h1>
      <div class="grow">
        <AppSearch v-if="tab === 'cover-letters'" v-model="search" />
      </div>
      <UploadResumeButton v-if="tab === 'resumes'" />
      <Button
        v-else-if="tab === 'cover-letters'"
        @click="
          $router.replace({
            query: { ...$route.query, 'dialog-name': 'generate-cover-letter' },
          })
        "
      >
        <PhSparkle />
        <span class="hidden lg:inline">Generate Cover Letter</span>
        <span class="lg:hidden">New</span>
      </Button>
    </PageHeader>

    <Tabs v-model="tab" class="px-6 gap-6">
      <TabsList aria-label="Documents">
        <TabsTrigger value="resumes">Resumes</TabsTrigger>
        <TabsTrigger value="cover-letters">Cover letters</TabsTrigger>
        <TabsTrigger value="people">People</TabsTrigger>
      </TabsList>
      <TabsContent value="resumes">
        <ResumesList />
      </TabsContent>
      <TabsContent value="cover-letters">
        <CoverLettersList />
      </TabsContent>
      <TabsContent value="people">
        <PeopleList />
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PhSparkle } from "@phosphor-icons/vue";
import { SearchSymbol } from "@/constants/symbols.ts";
import PageHeader from "@/components/PageHeader.vue";
import AppSearch from "@/components/AppSearch.vue";
import ResumesList from "@/components/ResumesList.vue";
import CoverLettersList from "@/components/CoverLettersList.vue";
import PeopleList from "@/components/PeopleList.vue";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DocumentsTab = "resumes" | "cover-letters" | "people";

const route = useRoute();
const router = useRouter();

// The tab lives in the url (?tab=) so links and redirects can open either one
const tab = computed<DocumentsTab>({
  get: () => (route.query.tab === "cover-letters" ? "cover-letters" : route.query.tab === "people" ? "people" : "resumes"),
  set: (value) => router.replace({ query: { ...route.query, tab: value } }),
});

const search = ref("");

provide(
  SearchSymbol,
  computed(() => search.value.trim().toLowerCase()),
);
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
