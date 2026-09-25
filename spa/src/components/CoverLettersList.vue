<template>
  <div>
    <div v-if="isLoading" class="flex justify-center py-8">
      <PhSpinner :size="32" class="animate-spin text-muted-foreground" />
    </div>
    <Empty v-else-if="filteredCoverLetters.length === 0" class="py-12">
      <template v-if="coverLetters.length === 0">
        <EmptyIcon>
          <PhFileText :size="32" />
        </EmptyIcon>
        <div class="space-y-2">
          <EmptyTitle>No cover letters yet</EmptyTitle>
          <EmptyDescription>
            Generate your first cover letter to get started
          </EmptyDescription>
        </div>
        <EmptyAction>
          <div class="flex flex-col items-center gap-2">
            <Button
              @click="
                $router.replace({
                  query: {
                    ...$route.query,
                    'dialog-name': 'generate-cover-letter',
                  },
                })
              "
            >
              <PhSparkle />
              Generate Cover Letter
            </Button>
          </div>
        </EmptyAction>
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
    </Empty>
    <!-- Search filters this list (filteredCoverLetters; it used to loop over all of them) -->
    <ul v-else class="overflow-hidden rounded-card bg-card shadow-card dark:border dark:border-border">
      <li
        v-for="coverLetter in filteredCoverLetters"
        :key="coverLetter.id"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-4 last:border-0"
      >
        <span class="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <PhEnvelopeSimple :size="22" />
        </span>
        <div class="flex min-w-0 grow basis-60 flex-col gap-0.5">
          <RouterLink :to="`/jobs/${coverLetter.jobApplication.id}`" class="font-bold hover:underline">
            {{ coverLetter.jobApplication.position || "Untitled job" }}
          </RouterLink>
          <p class="text-sm text-muted-foreground">
            {{ coverLetter.jobApplication.companyName || "Unknown company" }} · {{ formatDate(coverLetter.createdAt) }}
          </p>
          <p class="line-clamp-1 text-sm text-soft-foreground">{{ coverLetter.body }}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          @click="
            $router.replace({
              query: {
                ...$route.query,
                'dialog-name': 'cover-letter-preview',
                'cover-letter-id': coverLetter.id,
              },
            })
          "
        >
          <PhEye />
          Open
        </Button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import {
  PhEnvelopeSimple,
  PhEye,
  PhFileText,
  PhMagnifyingGlass,
  PhSparkle,
  PhSpinner,
} from "@phosphor-icons/vue";
import { SearchSymbol } from "@/constants/symbols";
import { useCoverLetters } from "@/composables/useCoverLetters";
import { Button } from "@/components/ui/button";
import type { CoverLetter } from "@/types";
import type { Timestamp } from "firebase/firestore";
import {
  Empty,
  EmptyAction,
  EmptyDescription,
  EmptyIcon,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";

const search = inject(
  SearchSymbol,
  computed(() => ""),
);
const { coverLetters, isLoading } = useCoverLetters();

const filteredCoverLetters = computed(() => {
  if (!coverLetters.value) return [];
  if (!search.value) return coverLetters.value;

  return coverLetters.value.filter((coverLetter: CoverLetter) => {
    const jobApplication = coverLetter.jobApplication;
    if (!jobApplication) return false;

    return (
      jobApplication.companyName.toLowerCase().includes(search.value) ||
      jobApplication.position.toLowerCase().includes(search.value)
    );
  });
});

const formatDate = (timestamp: Timestamp) =>
  formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
</script>
