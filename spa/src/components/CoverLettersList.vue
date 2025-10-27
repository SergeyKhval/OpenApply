<template>
  <div>
    <div v-if="isLoading" class="flex justify-center py-8">
      <PhSpinner :size="32" class="animate-spin text-gray-400" />
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
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <Card v-for="coverLetter in coverLetters" :key="coverLetter.id">
        <CardHeader>
          <CardTitle>
            <RouterLink
              :to="`/dashboard/applications/${coverLetter.jobApplication.id}`"
              class="text-lg text-primary hover:underline"
            >
              {{ coverLetter.jobApplication.position || "Unknown" }}
            </RouterLink>
          </CardTitle>
          <CardDescription>
            {{ coverLetter.jobApplication.companyName || "Unknown" }},
            {{ formatDate(coverLetter.createdAt) }}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p class="line-clamp-2">{{ coverLetter.body }}</p>
        </CardContent>

        <CardFooter>
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
            View
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import {
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
