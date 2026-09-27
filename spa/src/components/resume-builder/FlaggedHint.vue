<template>
  <p v-if="show" class="flex items-start gap-1.5 text-sm text-signal-text">
    <PhWarningCircle :size="16" class="mt-0.5 shrink-0" />
    {{ FLAGGED_HINT }}
  </p>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { PhWarningCircle } from "@phosphor-icons/vue";
import { FLAGGED_FIELDS, FLAGGED_HINT, isFlagged } from "@/lib/resumeImport";

// Under a field an import proposed but couldn't confirm, until it's filled in
type FlaggedHintProps = { path: string; value: unknown };

const { path, value } = defineProps<FlaggedHintProps>();
const flagged = inject(FLAGGED_FIELDS, null);
const show = computed(() => !!flagged && isFlagged(flagged.value, path, value));
</script>
