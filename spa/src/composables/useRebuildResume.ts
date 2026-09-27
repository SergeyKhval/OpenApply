import { computed, ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/components/ui/toast";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { importResume } from "@/composables/useResumeImport";
import { trackEvent, type ResumeBuilderSurface } from "@/analytics";
import type { Resume } from "@/types";

/**
 * "Edit as a new resume": copies an uploaded PDF's text into a new resume in
 * the editor (flag resume-builder). The PDF, its matches and tailored
 * versions stay as they are. Counts one offer the first time it's shown.
 */
export function useRebuildResume(resume: MaybeRefOrGetter<Resume>, surface: ResumeBuilderSurface) {
  const enabled = useFeatureFlag("resume-builder");
  const router = useRouter();
  const { toast } = useToast();
  const isCopying = ref(false);

  const shown = computed(() => {
    const value = toValue(resume);
    return enabled.value && value.kind !== "built" && value.status === "parsed";
  });

  let offered = false;
  watch(
    shown,
    (isShown) => {
      if (!isShown || offered) return;
      offered = true;
      trackEvent("resume_builder_offered", { surface, hadResume: true });
    },
    { immediate: true },
  );

  async function rebuild() {
    if (isCopying.value) return;
    isCopying.value = true;
    try {
      const resumeId = await importResume({ source: "resume", resumeId: toValue(resume).id });
      await router.push({ name: "/documents/resumes/[resumeId]", params: { resumeId } });
    } catch (error) {
      toast({
        title: "We couldn't copy this resume",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      isCopying.value = false;
    }
  }

  return { shown, isCopying, rebuild };
}
