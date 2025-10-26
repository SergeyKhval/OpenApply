<template>
  <div>
    <PageHeader>
      <h2 class="text-2xl font-semibold whitespace-nowrap">Cover Letters</h2>
      <div class="grow">
        <AppSearch v-model="search" />
      </div>
      <Button
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

    <div class="px-6">
      <CoverLettersList />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide } from "vue";
import { SearchSymbol } from "@/constants/symbols.ts";
import PageHeader from "@/components/PageHeader.vue";
import CoverLettersList from "@/components/CoverLettersList.vue";
import AppSearch from "@/components/AppSearch.vue";
import { Button } from "@/components/ui/button";
import { PhSparkle } from "@phosphor-icons/vue";

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
