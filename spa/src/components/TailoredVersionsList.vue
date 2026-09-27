<!-- Tailored versions of one resume, newest per job (flag tailored-resume) -->
<template>
  <div class="flex flex-col gap-1.5">
    <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tailored versions</p>
    <ul class="flex flex-col gap-1">
      <li v-for="version in versions" :key="version.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <PhMagicWand :size="16" class="shrink-0 text-muted-foreground" />
        <button type="button" class="min-w-0 truncate font-semibold text-secondary-foreground hover:underline" @click="emit('open', version)">
          {{ jobLabel(version) }}
        </button>
        <span class="text-muted-foreground">{{ versionLabel(version) }}</span>
        <template v-if="confirmingId === version.id">
          <Button size="sm" variant="destructive" :disabled="deleting" @click="emit('delete', version)">Delete for this job</Button>
          <Button size="sm" variant="ghost" :disabled="deleting" @click="confirmingId = null">Keep</Button>
        </template>
        <Button
          v-else
          variant="ghost"
          size="icon-sm"
          class="ml-auto"
          :aria-label="`Delete the tailored versions for ${jobLabel(version)}`"
          @click="confirmingId = version.id"
        >
          <PhTrash :size="16" />
        </Button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PhMagicWand, PhTrash } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import type { TailoredResume } from "@/types";

export type TailoredVersionEntry = TailoredResume & { count: number };

type TailoredVersionsListProps = {
  versions: TailoredVersionEntry[];
  deleting?: boolean;
};

type TailoredVersionsListEmits = {
  (event: "open", version: TailoredVersionEntry): void;
  (event: "delete", version: TailoredVersionEntry): void;
};

const { versions, deleting = false } = defineProps<TailoredVersionsListProps>();
const emit = defineEmits<TailoredVersionsListEmits>();

const confirmingId = ref<string | null>(null);

const jobLabel = (version: TailoredResume) =>
  [version.jobApplication.companyName, version.jobApplication.position].filter(Boolean).join(" · ") || "A saved job";

function versionLabel(version: TailoredVersionEntry): string {
  const date = version.createdAt?.toDate?.().toLocaleDateString(undefined, { day: "numeric", month: "short" }) ?? "";
  const older = version.count > 1 ? ` · ${version.count - 1} older` : "";
  return `${date}${older}`;
}
</script>
