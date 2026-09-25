<!-- AI resume match for one resume and one job (canvas "AI resume match") -->
<template>
  <AiSheet :open="open" title="Resume match" :eyebrow="`${application.companyName} · ${application.position}`" @update:open="emit('update:open', $event)">
    <p class="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
      Resume <ResumeLink :resume="resume" />
    </p>

    <div v-if="isRunning" class="flex flex-col items-center gap-4 py-10 text-center" role="status">
      <Spinner class="size-10" />
      <p class="text-[15px] text-soft-foreground">Checking your resume against the job. This takes up to a minute.</p>
    </div>

    <AiLimitReached v-else-if="showLimit && allowance" :allowance="allowance" source="ai_review" />

    <template v-else-if="view">
      <section class="flex items-center gap-4 rounded-card bg-muted p-4">
        <ResumeScore class="size-18 shrink-0" :score="view.score" />
        <div class="flex flex-col gap-0.5">
          <p class="text-[17px] font-bold">{{ view.verdict }}</p>
          <p v-if="view.countsLine" class="text-sm text-soft-foreground">{{ view.countsLine }}</p>
        </div>
      </section>

      <section v-if="view.requirements.length" class="flex flex-col gap-2">
        <h3 class="text-[17px] font-bold">Requirements</h3>
        <ul class="flex flex-col divide-y divide-border">
          <li v-for="requirement in view.requirements" :key="requirement.label" class="flex items-start gap-3 py-3">
            <span class="inline-flex h-6 w-[4.5rem] shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="PILL[requirement.status].class">
              {{ PILL[requirement.status].label }}
            </span>
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-[15px] font-semibold">{{ requirement.label }}</span>
              <span v-if="requirement.evidence" class="text-sm text-soft-foreground">{{ requirement.evidence }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="view.fixes.length" class="flex flex-col gap-2">
        <h3 class="text-[17px] font-bold">
          {{ view.fixes.length === 1 ? "1 fix" : `${view.fixes.length} fixes` }} before you apply
        </h3>
        <ol class="flex flex-col gap-3">
          <li v-for="(fix, index) in view.fixes" :key="index" class="flex items-start gap-3 text-[15px]">
            <span class="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{{ index + 1 }}</span>
            <span>{{ fix }}</span>
          </li>
        </ol>
      </section>
    </template>

    <template v-else>
      <p class="text-[15px] text-soft-foreground">
        See which requirements your resume meets, which it misses, and what to fix before you apply. It reads
        the job description you saved and this resume, nothing else.
      </p>
      <Alert v-if="!application.jobDescription" variant="destructive">
        <PhWarningCircle />
        <AlertDescription>This job has no description yet. Add it on the job page, then run the match.</AlertDescription>
      </Alert>
    </template>

    <Alert v-if="errorMessage && !isRunning" variant="destructive">
      <PhWarningCircle />
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>

    <template v-if="!isRunning && !showLimit" #footer>
      <AiChecksLeft v-if="allowance" :allowance="allowance" />
      <div class="flex flex-col gap-2 sm:flex-row">
        <template v-if="view">
          <Button variant="outline" @click="runMatch">
            <PhArrowsClockwise />
            Check again · 1 check
          </Button>
          <Button @click="writeCoverLetter">
            <PhPenNib />
            Write a cover letter for this job
          </Button>
        </template>
        <Button v-else :disabled="!application.jobDescription" @click="runMatch">
          <PhSparkle />
          Check my resume · 1 check
        </Button>
      </div>
    </template>
  </AiSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { PhArrowsClockwise, PhPenNib, PhSparkle, PhWarningCircle } from "@phosphor-icons/vue";
import AiChecksLeft from "@/components/AiChecksLeft.vue";
import AiLimitReached from "@/components/AiLimitReached.vue";
import ResumeLink from "@/components/ResumeLink.vue";
import ResumeScore from "@/components/ResumeScore.vue";
import AiSheet from "@/components/ai/AiSheet.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { db, functions } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { toMatchView, type RequirementStatus } from "@/lib/matchView";
import type { JobApplication, Resume, ResumeJobMatch } from "@/types";

type ResumeMatchSheetProps = {
  open: boolean;
  resume: Resume;
  application: Pick<JobApplication, "id" | "companyName" | "position" | "jobDescription">;
};

type ResumeMatchSheetEmits = {
  (event: "update:open", value: boolean): void;
};

const { open, resume, application } = defineProps<ResumeMatchSheetProps>();
const emit = defineEmits<ResumeMatchSheetEmits>();

const PILL: Record<RequirementStatus, { label: string; class: string }> = {
  met: { label: "Met", class: "bg-success-soft text-success" },
  partly: { label: "Partly", class: "bg-stage-interviewing-soft text-stage-interviewing-text" },
  missing: { label: "Missing", class: "bg-destructive-soft text-destructive" },
};

const user = useCurrentUser();
const router = useRouter();
const route = useRoute();
const { allowance, canUseAi } = useAiAllowance();

// Newest match for this resume and job; "Check again" adds a new one
const matchQuery = computed(() =>
  user.value
    ? query(
        collection(db, "resumeJobMatches"),
        where("userId", "==", user.value.uid),
        where("resumeId", "==", resume.id),
        where("jobApplicationId", "==", application.id),
        orderBy("createdAt", "desc"),
        limit(1),
      )
    : null,
);
const matches = useCollection<ResumeJobMatch>(matchQuery);
const view = computed(() => (matches.value[0] ? toMatchView(matches.value[0].matchResult) : null));

const isRunning = ref(false);
const errorMessage = ref("");
const limitHit = ref(false);
// Out of checks: say so up front when there's no result to show yet
const showLimit = computed(() => limitHit.value || (!view.value && allowance.value !== null && !canUseAi.value));

watch(
  () => open,
  (isOpen) => {
    if (!isOpen) {
      errorMessage.value = "";
      limitHit.value = false;
    }
  },
);

const matchResumeWithJobApplication = httpsCallable(functions, "matchResumeWithJobApplication");

async function runMatch() {
  if (!canUseAi.value) {
    limitHit.value = true;
    return;
  }
  isRunning.value = true;
  errorMessage.value = "";
  trackEvent("resume_match_started", { resumeId: resume.id, jobApplicationId: application.id });
  try {
    await matchResumeWithJobApplication({ resumeId: resume.id, applicationId: application.id });
    trackEvent("resume_match_completed", { resumeId: resume.id, jobApplicationId: application.id });
  } catch (error) {
    const details = (error as { details?: { code?: string } }).details;
    if (details?.code === "ai-limit-reached") {
      limitHit.value = true;
    } else {
      errorMessage.value = "The match didn't finish. Nothing was counted; try again in a moment.";
    }
    trackEvent("resume_match_failed", { error: error instanceof Error ? error.message : String(error) });
  } finally {
    isRunning.value = false;
  }
}

function writeCoverLetter() {
  emit("update:open", false);
  router.replace({
    query: {
      ...route.query,
      "dialog-name": "generate-cover-letter",
      "application-id": application.id,
      "resume-id": resume.id,
    },
  });
}
</script>
