<template>
  <Button v-if="enabled" variant="secondary" :disabled="isCreating" @click="create">
    <PhSpinner v-if="isCreating" class="animate-spin" />
    <PhPencilSimpleLine v-else />
    <span>New<span class="hidden lg:inline"> resume</span></span>
  </Button>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useCurrentUser } from "vuefire";
import { PhPencilSimpleLine, PhSpinner } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { useResumes } from "@/composables/useResumes";
import { createBuiltResume } from "@/composables/useBuiltResume";
import { trackEvent, type ResumeBuilderSurface } from "@/analytics";

type NewResumeButtonProps = { surface: ResumeBuilderSurface };

const { surface } = defineProps<NewResumeButtonProps>();

const enabled = useFeatureFlag("resume-builder");
const user = useCurrentUser();
const resumes = useResumes();
const router = useRouter();
const { toast } = useToast();
const isCreating = ref(false);

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

async function create() {
  if (!user.value) return;
  isCreating.value = true;
  try {
    const id = await createBuiltResume(user.value.uid, { name: user.value.displayName, email: user.value.email });
    await router.push({ name: "/documents/resumes/[resumeId]", params: { resumeId: id } });
  } catch (error) {
    console.error("Creating a resume failed:", error);
    toast({ title: "We couldn't start a new resume", description: "Try again in a moment.", variant: "destructive" });
  } finally {
    isCreating.value = false;
  }
}
</script>
