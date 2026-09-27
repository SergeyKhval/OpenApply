<template>
  <Button v-if="shown" :variant="variant" :size="size" :disabled="isCopying" @click="rebuild">
    <PhSpinner v-if="isCopying" class="animate-spin" />
    <PhPencilSimpleLine v-else />
    <span v-if="isCopying">Copying your resume…</span>
    <slot v-else>Edit as a new resume</slot>
  </Button>
</template>

<script setup lang="ts">
import { PhPencilSimpleLine, PhSpinner } from "@phosphor-icons/vue";
import { Button, type ButtonVariants } from "@/components/ui/button";
import { useRebuildResume } from "@/composables/useRebuildResume";
import type { ResumeBuilderSurface } from "@/analytics";
import type { Resume } from "@/types";

type RebuildResumeButtonProps = {
  resume: Resume;
  surface: ResumeBuilderSurface;
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
};

const { resume, surface, variant = "outline", size = "sm" } = defineProps<RebuildResumeButtonProps>();
const { shown, isCopying, rebuild } = useRebuildResume(() => resume, surface);
</script>
