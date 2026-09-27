<!-- Job page: what went out with this application (canvas "Sent with this
     application"): the resume, a tailored version if there is one, and the
     cover letter. -->
<template>
  <Card class="gap-3">
    <CardHeader>
      <CardTitle class="text-base">Sent with this application</CardTitle>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <PhFileText :size="18" />
        </span>
        <div class="flex min-w-0 grow flex-col">
          <template v-if="resume">
            <ResumeLink :resume="resume" class="truncate text-[15px] font-semibold text-foreground hover:underline" />
            <span class="text-[13px] text-muted-foreground">Resume</span>
          </template>
          <template v-else>
            <span class="text-[15px] font-semibold">No resume yet</span>
            <span class="text-[13px] text-muted-foreground">Pick the one you sent</span>
          </template>
        </div>
      </div>

      <div v-if="tailored" class="flex items-center gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <PhMagicWand :size="18" />
        </span>
        <div class="flex min-w-0 grow flex-col">
          <span class="truncate text-[15px] font-semibold">Tailored resume</span>
          <span class="text-[13px] text-muted-foreground">Made {{ formatDay(tailored.createdAt) }}</span>
        </div>
        <Button variant="ghost" size="sm" @click="isTailoredOpen = true">Open</Button>
      </div>

      <div class="flex items-center gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <PhPencilSimple :size="18" />
        </span>
        <div class="flex min-w-0 grow flex-col">
          <span class="text-[15px] font-semibold">Cover letter</span>
          <span class="text-[13px] text-muted-foreground">
            {{ coverLetter ? `Written ${formatDay(coverLetter.createdAt)}` : "Not written yet" }}
          </span>
        </div>
        <Button v-if="application.coverLetterId" variant="ghost" size="sm" @click="openCoverLetter">Open</Button>
        <Button v-else variant="ghost" size="sm" @click="writeCoverLetter">Write</Button>
      </div>

      <button type="button" class="self-start text-sm font-semibold text-secondary-foreground underline underline-offset-2" @click="pickResume">
        {{ resume ? "Use a different resume" : "Choose a resume" }}
      </button>
    </CardContent>

    <TailoredResumeSheet
      v-if="tailored && tailoredSource"
      v-model:open="isTailoredOpen"
      :resume="tailoredSource"
      :application="application"
    />
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCollection, useCurrentUser, useDocument } from "vuefire";
import { collection, doc, limit, orderBy, query, where } from "firebase/firestore";
import { PhFileText, PhMagicWand, PhPencilSimple } from "@phosphor-icons/vue";
import ResumeLink from "@/components/ResumeLink.vue";
import TailoredResumeSheet from "@/components/ai/TailoredResumeSheet.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/firebase/config";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { toJsDate } from "@/lib/jobDates";
import type { CoverLetter, JobApplication, Resume, TailoredResume } from "@/types";

const { application, resumes } = defineProps<{ application: JobApplication; resumes: Resume[] }>();

const user = useCurrentUser();
const router = useRouter();
const route = useRoute();
const tailoringEnabled = useFeatureFlag("tailored-resume");
const isTailoredOpen = ref(false);

const resume = computed(() => resumes.find((candidate) => candidate.id === application.resumeId) ?? null);

const coverLetterRef = computed(() => (application.coverLetterId ? doc(db, "coverLetters", application.coverLetterId) : null));
const coverLetter = useDocument<CoverLetter>(coverLetterRef);

// Newest tailored version for this job (flag tailored-resume)
const tailoredQuery = computed(() =>
  user.value && tailoringEnabled.value
    ? query(
        collection(db, "tailoredResumes"),
        where("userId", "==", user.value.uid),
        where("jobApplicationId", "==", application.id),
        orderBy("createdAt", "desc"),
        limit(1),
      )
    : null,
);
const tailoredVersions = useCollection<TailoredResume>(tailoredQuery);
const tailored = computed(() => tailoredVersions.value[0] ?? null);
const tailoredSource = computed(() => resumes.find((candidate) => candidate.id === tailored.value?.resumeId) ?? null);

const formatDay = (value: unknown) =>
  toJsDate(value)?.toLocaleDateString(undefined, { day: "numeric", month: "short" }) ?? "";

function openCoverLetter() {
  router.replace({
    query: { ...route.query, "dialog-name": "cover-letter-preview", "cover-letter-id": application.coverLetterId },
  });
}

function writeCoverLetter() {
  router.replace({
    query: {
      ...route.query,
      "dialog-name": "generate-cover-letter",
      "application-id": application.id,
      ...(resume.value ? { "resume-id": resume.value.id } : {}),
    },
  });
}

function pickResume() {
  router.replace({
    query: {
      ...route.query,
      "dialog-name": "resume-picker",
      "application-id": application.id,
      ...(resume.value ? { "resume-id": resume.value.id } : {}),
    },
  });
}
</script>
