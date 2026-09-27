<template>
  <!-- Stays open while copying, so the wait shows where it was asked for -->
  <DropdownMenuItem v-if="shown" :disabled="isCopying" @select="onSelect">
    <PhSpinner v-if="isCopying" class="animate-spin" />
    <PhPencilSimpleLine v-else />
    {{ isCopying ? "Copying your resume…" : "Edit as a new resume" }}
  </DropdownMenuItem>
</template>

<script setup lang="ts">
import { PhPencilSimpleLine, PhSpinner } from "@phosphor-icons/vue";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useRebuildResume } from "@/composables/useRebuildResume";
import type { Resume } from "@/types";

// The resume card's "..." menu in Documents
const { resume } = defineProps<{ resume: Resume }>();
const { shown, isCopying, rebuild } = useRebuildResume(() => resume, "resume_menu");

function onSelect(event: Event) {
  event.preventDefault();
  void rebuild();
}
</script>
