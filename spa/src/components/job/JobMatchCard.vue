<!-- Job page: the newest resume match for this job (canvas "Resume match"), or
     how to get one. The full breakdown opens in the match sheet. -->
<template>
  <slot v-if="!view && $slots.fallback" name="fallback" />
  <Card v-else class="gap-4">
    <CardHeader class="flex flex-row items-center justify-between gap-3">
      <CardTitle class="text-lg">Resume match</CardTitle>
      <span v-if="checkedOn" class="text-[13px] text-muted-foreground">Checked {{ checkedOn }}</span>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <template v-if="view && matchResume">
        <div class="flex items-center gap-4">
          <ResumeScore class="size-16 shrink-0" :score="view.score" />
          <div class="flex min-w-0 flex-col gap-0.5">
            <p class="text-[15px] font-bold">{{ view.verdict }}</p>
            <p v-if="summaryLine" class="text-sm text-soft-foreground">{{ summaryLine }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="isMatchOpen = true"><PhSparkle />See details</Button>
          <Button variant="ghost" size="sm" @click="writeCoverLetter"><PhPencilSimple />Write cover letter</Button>
          <Button v-if="canTailor" variant="ghost" size="sm" @click="isTailoredOpen = true">
            <PhMagicWand />Tailor resume
          </Button>
        </div>
      </template>

      <template v-else-if="matchResume">
        <p class="text-[15px] text-soft-foreground">
          See which requirements <span class="font-semibold text-foreground">{{ matchResume.fileName }}</span> meets and
          what to fix before you apply.
        </p>
        <Button size="sm" class="self-start" @click="isMatchOpen = true"><PhSparkle />Check my resume</Button>
      </template>

      <template v-else>
        <p class="text-[15px] text-soft-foreground">
          Upload a resume to see how it stacks up against this job and what to fix before you apply.
        </p>
        <Button size="sm" class="self-start" :disabled="isUploading" @click="openFileDialog()">
          <PhUploadSimple />{{ isUploading ? "Uploading…" : "Upload resume" }}
        </Button>
      </template>
    </CardContent>

    <template v-if="matchResume">
      <ResumeMatchSheet
        v-model:open="isMatchOpen"
        :resume="matchResume"
        :application="application"
        @tailor="isTailoredOpen = true"
      />
      <TailoredResumeSheet v-if="tailoringEnabled" v-model:open="isTailoredOpen" :resume="matchResume" :application="application" />
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { PhMagicWand, PhPencilSimple, PhSparkle, PhUploadSimple } from "@phosphor-icons/vue";
import ResumeScore from "@/components/ResumeScore.vue";
import ResumeMatchSheet from "@/components/ai/ResumeMatchSheet.vue";
import TailoredResumeSheet from "@/components/ai/TailoredResumeSheet.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/firebase/config";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { useResumeUpload } from "@/composables/useResumeUpload";
import { toJsDate } from "@/lib/jobDates";
import { mustHaveLine, toMatchView } from "@/lib/matchView";
import type { JobApplication, Resume, ResumeJobMatch } from "@/types";

const { application, resumes } = defineProps<{ application: JobApplication; resumes: Resume[] }>();

const user = useCurrentUser();
const router = useRouter();
const route = useRoute();
const { openFileDialog, isUploading } = useResumeUpload();
const tailoringEnabled = useFeatureFlag("tailored-resume");

const isMatchOpen = ref(false);
const isTailoredOpen = ref(false);

// Newest match for this job, whichever resume it was run with
const matchQuery = computed(() =>
  user.value
    ? query(
        collection(db, "resumeJobMatches"),
        where("userId", "==", user.value.uid),
        where("jobApplicationId", "==", application.id),
        orderBy("createdAt", "desc"),
        limit(1),
      )
    : null,
);
const matches = useCollection<ResumeJobMatch>(matchQuery);
const latest = computed(() => matches.value[0] ?? null);

// The matched resume, else the one sent with the job, else the newest upload
const matchResume = computed(
  () =>
    resumes.find((resume) => resume.id === latest.value?.resumeId) ??
    resumes.find((resume) => resume.id === application.resumeId) ??
    resumes[0] ??
    null,
);

const view = computed(() => (latest.value && latest.value.resumeId === matchResume.value?.id ? toMatchView(latest.value.matchResult) : null));
const summaryLine = computed(() =>
  latest.value?.analysis ? mustHaveLine(latest.value.analysis.requirements) || view.value?.countsLine : view.value?.countsLine,
);
const checkedOn = computed(() => {
  const date = view.value ? toJsDate(latest.value?.createdAt) : null;
  return date ? date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
});
const canTailor = computed(() => tailoringEnabled.value && Boolean(latest.value?.analysis));

function writeCoverLetter() {
  router.replace({
    query: {
      ...route.query,
      "dialog-name": "generate-cover-letter",
      "application-id": application.id,
      ...(matchResume.value ? { "resume-id": matchResume.value.id } : {}),
    },
  });
}
</script>
