<template>
  <AiSheet :open="isOpen" title="Cover letter" :eyebrow="eyebrow" @update:open="updateDialogOpenState">
    <template v-if="coverLetter" #description>
      Written from the job<template v-if="resumeName"> and <b class="font-semibold text-foreground">{{ resumeName }}</b></template>.
      Saved in Documents.
    </template>

    <div v-if="isProcessing" class="flex flex-col items-center gap-4 py-10 text-center" role="status">
      <Spinner class="size-10" />
      <p class="text-[15px] text-soft-foreground">{{ processingMessage }}</p>
    </div>

    <AiLimitReached v-else-if="limitHit && allowance" :allowance="allowance" source="regenerate_cover_letter" />

    <template v-else-if="coverLetter">
      <div v-if="canRegenerate" class="flex flex-col gap-3">
        <ChoicePills v-model="length" label="Length" :options="LENGTH_OPTIONS" />
        <ChoicePills v-model="tone" label="Tone" :options="TONE_OPTIONS" />
      </div>

      <Textarea
        v-if="isEditMode"
        v-model="localCoverLetterBody"
        aria-label="Cover letter"
        class="min-h-[420px] text-[15px] leading-relaxed"
      />
      <div
        v-else
        class="rounded-card border border-border bg-card p-5 text-[15px] leading-relaxed whitespace-pre-wrap"
      >{{ localCoverLetterBody }}</div>

      <p class="text-[13px] text-muted-foreground">
        Created {{ formatDate(coverLetter.createdAt) }}<template v-if="coverLetter.updatedAt">, updated {{ formatDate(coverLetter.updatedAt) }}</template>.
        Read it before you send it: the AI can get details wrong.
      </p>

      <Alert v-if="errorMessage" variant="destructive">
        <PhWarningCircle />
        <AlertDescription>{{ errorMessage }}</AlertDescription>
      </Alert>
    </template>

    <template v-if="coverLetter && !isProcessing && !limitHit" #footer>
      <AiChecksLeft v-if="allowance && canRegenerate" :allowance="allowance" />
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="!isSupported" @click="copy(localCoverLetterBody)">
          <PhCheck v-if="copied" />
          <PhCopy v-else />
          {{ copied ? "Copied" : "Copy" }}
        </Button>
        <Button v-if="hasChanges" @click="handleSave">
          <PhCheck />
          Save changes
        </Button>
        <Button v-else variant="outline" @click="isEditMode = !isEditMode">
          <PhEye v-if="isEditMode" />
          <PhPencilSimple v-else />
          {{ isEditMode ? "Done editing" : "Edit" }}
        </Button>
        <Button v-if="canRegenerate" variant="outline" @click="handleRegenerate">
          <PhArrowsClockwise />
          Rewrite · 1 check
        </Button>
      </div>
    </template>
  </AiSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useClipboard } from "@vueuse/core";
import {
  PhArrowsClockwise,
  PhCheck,
  PhCopy,
  PhEye,
  PhPencilSimple,
  PhWarningCircle,
} from "@phosphor-icons/vue";
import { collection, doc, Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { useDocument } from "vuefire";
import { useRoute, useRouter } from "vue-router";
import { omit } from "lodash";
import AiChecksLeft from "@/components/AiChecksLeft.vue";
import AiLimitReached from "@/components/AiLimitReached.vue";
import AiSheet from "@/components/ai/AiSheet.vue";
import ChoicePills from "@/components/ai/ChoicePills.vue";
import { LENGTH_OPTIONS, TONE_OPTIONS } from "@/components/ai/coverLetterOptions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useCoverLetters, type CoverLetterStyle } from "@/composables/useCoverLetters";
import { useResumes } from "@/composables/useResumes";
import { db } from "@/firebase/config.ts";
import type { CoverLetter } from "@/types";

type CoverLetterPreviewProps = {
  isOpen: boolean;
};

const { isOpen } = defineProps<CoverLetterPreviewProps>();

const router = useRouter();
const route = useRoute();

const coverLetterId = computed(() => route.query["cover-letter-id"] as string);
const coverLetterRef = computed(() =>
  coverLetterId.value
    ? doc(collection(db, "coverLetters"), coverLetterId.value)
    : null,
);

const coverLetter = useDocument<CoverLetter>(coverLetterRef);

const localCoverLetterBody = ref(coverLetter.value?.body || "");
const originalBody = ref(coverLetter.value?.body || "");
const isEditMode = ref(false);
const isProcessing = ref(false);
const processingMessage = ref("");
const errorMessage = ref("");

const { allowance, canUseAi } = useAiAllowance();
const limitHit = ref(false);

const length = ref<CoverLetterStyle["length"]>("standard");
const tone = ref<CoverLetterStyle["tone"]>("plain");
// A rewrite starts from the choices the letter was written with
watch(
  () => coverLetter.value?.id,
  () => {
    length.value = coverLetter.value?.style?.length ?? "standard";
    tone.value = coverLetter.value?.style?.tone ?? "plain";
  },
  { immediate: true },
);

const resumes = useResumes();
const resumeName = computed(
  () => resumes.value.find((resume) => resume.id === coverLetter.value?.resumeId)?.fileName ?? "",
);
const eyebrow = computed(() =>
  coverLetter.value?.jobApplication
    ? `${coverLetter.value.jobApplication.companyName} · ${coverLetter.value.jobApplication.position}`
    : undefined,
);

const { copy, copied, isSupported } = useClipboard();
const { updateCoverLetter, regenerateCoverLetter } = useCoverLetters();

const hasChanges = computed(
  () => localCoverLetterBody.value !== originalBody.value,
);

const canRegenerate = computed(() =>
  Boolean(coverLetter.value?.jobApplication && coverLetter.value?.resumeId),
);

const formatDate = (timestamp: Timestamp) =>
  formatDistanceToNow(timestamp.toDate(), { addSuffix: true });

const handleSave = async () => {
  if (!hasChanges.value || !coverLetter.value) return;

  isProcessing.value = true;
  processingMessage.value = "Saving your changes.";
  errorMessage.value = "";

  const result = await updateCoverLetter(
    coverLetter.value?.id,
    localCoverLetterBody.value,
  );

  isProcessing.value = false;

  if (result.success) {
    originalBody.value = localCoverLetterBody.value;
    isEditMode.value = false;
  } else {
    errorMessage.value = result.error || "Failed to save changes";
  }
};

const handleRegenerate = async () => {
  if (!canRegenerate.value || !coverLetter.value) return;

  if (!canUseAi.value) {
    limitHit.value = true;
    return;
  }

  isProcessing.value = true;
  processingMessage.value = "Rewriting your cover letter. This takes 20 to 30 seconds.";
  errorMessage.value = "";

  const result = await regenerateCoverLetter(
    coverLetter.value?.id,
    coverLetter.value?.jobApplication.id,
    coverLetter.value?.resumeId,
    { length: length.value, tone: tone.value },
  );

  isProcessing.value = false;

  if (result.success && result.data) {
    localCoverLetterBody.value = result.data.body;
    originalBody.value = result.data.body;
    isEditMode.value = false;
  } else if (!result.success) {
    if (result.code === "ai-limit-reached") limitHit.value = true;
    else errorMessage.value = result.error || "The rewrite didn't finish. Nothing was counted; try again.";
  }
};

// Update local body when prop changes
watch(
  () => coverLetter.value?.body,
  (newBody) => {
    if (newBody) {
      localCoverLetterBody.value = newBody;
      originalBody.value = newBody;
    }
  },
);

// Reset state when dialog closes
watch(
  () => isOpen,
  (newValue) => {
    if (!newValue) {
      // Reset to original values after a delay to avoid visual glitches
      setTimeout(() => {
        localCoverLetterBody.value = coverLetter.value?.body || "";
        originalBody.value = coverLetter.value?.body || "";
        isEditMode.value = false;
        errorMessage.value = "";
        limitHit.value = false;
      }, 200);
    }
  },
);

function updateDialogOpenState(open: boolean) {
  if (!open) {
    router.replace({
      query: omit(route.query, ["dialog-name", "cover-letter-id"]),
    });
  }
}
</script>
