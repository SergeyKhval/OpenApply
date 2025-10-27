<template>
  <ul class="flex flex-col gap-3 divide-y divide-border">
    <li
      v-for="interview in interviews"
      :key="interview.id"
      class="flex items-center justify-between pb-3"
    >
      <div class="flex flex-col">
        <time
          class="text-xs text-muted-foreground"
          :datetime="interview.conductedAt.toDate().toLocaleDateString()"
        >
          {{ interview.conductedAt.toDate().toLocaleDateString() }}
        </time>
        <p>{{ interview.name }}</p>
      </div>
      <div class="shrink-0">
        <Button
          size="sm"
          variant="ghost"
          @click="emit('edit', interview.id)"
        >
          <PhPencil />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          @click="emit('delete', interview.id)"
        >
          <PhTrash />
        </Button>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { PhPencil, PhTrash } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import type { Interview } from "@/types";

type InterviewListProps = {
  interviews: Interview[];
};

type InterviewListEmits = {
  (event: "edit", interviewId: string): void;
  (event: "delete", interviewId: string): void;
};

defineProps<InterviewListProps>();
const emit = defineEmits<InterviewListEmits>();
</script>