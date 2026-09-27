<template>
  <template v-if="enabled">
    <!-- Two roots (button and sheet): class and aria-label go to the button -->
    <Button :variant="variant" :size="size" v-bind="$attrs" @click="open = true">
      <PhPencilSimpleLine />
      <slot><span>New<span class="hidden lg:inline"> resume</span></span></slot>
    </Button>
    <NewResumeSheet v-model:open="open" />
  </template>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { PhPencilSimpleLine } from "@phosphor-icons/vue";
import { Button, type ButtonVariants } from "@/components/ui/button";
import NewResumeSheet from "@/components/resume-builder/NewResumeSheet.vue";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { useResumes } from "@/composables/useResumes";
import { trackEvent, type ResumeBuilderSurface } from "@/analytics";

type NewResumeButtonProps = { surface: ResumeBuilderSurface; variant?: ButtonVariants["variant"]; size?: ButtonVariants["size"] };

defineOptions({ inheritAttrs: false });

const { surface, variant = "secondary", size } = defineProps<NewResumeButtonProps>();

const enabled = useFeatureFlag("resume-builder");
const resumes = useResumes();
const open = ref(false);

// Once per mount, when the button is actually on screen and the list has
// loaded, so hadResume is true for someone who has one
let offered = false;
watch(
  [enabled, () => resumes.pending.value],
  ([isOn, isLoading]) => {
    if (!isOn || isLoading || offered) return;
    offered = true;
    trackEvent("resume_builder_offered", { surface, hadResume: resumes.value.length > 0 });
  },
  { immediate: true },
);
</script>
