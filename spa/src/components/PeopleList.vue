<!-- Read-only directory of every contact across every job, grouped by person.
     Adding/editing a contact still happens on that job's page. -->
<template>
  <div class="w-full">
    <ul v-if="people.length > 0" class="overflow-hidden rounded-card bg-card shadow-card dark:border dark:border-border">
      <li
        v-for="person in people"
        :key="person.key"
        class="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border px-5 py-4 last:border-0"
      >
        <span class="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <PhUser :size="22" />
        </span>
        <div class="flex min-w-0 grow basis-60 flex-col gap-0.5">
          <p class="font-semibold">
            {{ displayName(person) }}<span v-if="person.position" class="font-normal text-soft-foreground">, {{ person.position }}</span>
          </p>
          <a
            v-if="person.email"
            :href="`mailto:${person.email}`"
            class="text-sm text-secondary-foreground hover:underline"
          >{{ person.email }}</a>
          <p class="flex flex-wrap gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
            <template v-for="(job, index) in person.jobs" :key="job.jobApplicationId">
              <RouterLink :to="`/jobs/${job.jobApplicationId}`" class="hover:underline hover:text-secondary-foreground">{{ job.companyName }}</RouterLink>
              <span v-if="index < person.jobs.length - 1">·</span>
            </template>
          </p>
        </div>
        <span v-if="person.lastInteractionAt" class="text-sm text-muted-foreground sm:w-32 sm:text-right">
          Last contact {{ formatDate(person.lastInteractionAt) }}
        </span>
      </li>
    </ul>
    <Empty v-else class="py-12">
      <EmptyIcon>
        <PhUsers :size="32" />
      </EmptyIcon>
      <div class="space-y-2">
        <EmptyTitle>No contacts yet</EmptyTitle>
        <EmptyDescription>
          Add a contact from any job's page and they'll show up here, grouped across every job you've talked to them about.
        </EmptyDescription>
      </div>
    </Empty>
  </div>
</template>

<script setup lang="ts">
import { PhUser, PhUsers } from "@phosphor-icons/vue";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "@/components/ui/empty";
import { usePeople } from "@/composables/usePeople";
import type { PersonGroup } from "@/lib/people";

const { people } = usePeople();

const displayName = (person: PersonGroup) => `${person.firstName} ${person.lastName}`.trim() || person.email || "Contact";
const formatDate = (date: Date) => date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
</script>
