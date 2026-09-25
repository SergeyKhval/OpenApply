<template>
  <Empty class="sm:w-50 relative py-5 px-2 gap-4 border-solid">
    <ResumeScore
      v-if="latestScore !== null"
      class="absolute top-2 right-2 size-8"
      :score="latestScore"
    />

    <EmptyIcon class="border-solid text-foreground border-foreground">
      <PhFilePdf :size="36" />
    </EmptyIcon>

    <ResumeLink
      :resume="resume"
      class="truncate max-w-full text-xs text-primary hover:underline"
    />

    <EmptyDescription class="text-foreground">
      <Button size="sm" variant="outline" @click="isSheetOpen = true">
        <PhSparkle />
        {{ latestScore !== null ? "See match" : "Check match" }}
      </Button>
    </EmptyDescription>

    <ResumeMatchSheet v-model:open="isSheetOpen" :resume="resume" :application="application" />
  </Empty>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { PhFilePdf, PhSparkle } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyIcon } from "@/components/ui/empty";
import ResumeLink from "@/components/ResumeLink.vue";
import ResumeScore from "@/components/ResumeScore.vue";
import ResumeMatchSheet from "@/components/ai/ResumeMatchSheet.vue";
import { db } from "@/firebase/config.ts";
import type { JobApplication, Resume, ResumeJobMatch } from "@/types";

type ResumeAttachmentCardProps = {
  resume: Resume;
  application: JobApplication;
};

const { resume, application } = defineProps<ResumeAttachmentCardProps>();

const user = useCurrentUser();
const isSheetOpen = ref(false);

const latestMatchQuery = computed(() =>
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
const latestMatches = useCollection<ResumeJobMatch>(latestMatchQuery);
const latestScore = computed(() => {
  const percent = latestMatches.value[0]?.matchResult.match_summary.overall_match_percent;
  return typeof percent === "number" ? Math.round(percent) : null;
});
</script>
