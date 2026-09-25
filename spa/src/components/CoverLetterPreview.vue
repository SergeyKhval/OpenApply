<template>
  <Dialog :open="isOpen" @update:open="updateDialogOpenState">
    <DialogScrollContent class="md:min-w-200">
      <DialogHeader>
        <DialogTitle>Cover Letter</DialogTitle>
        <DialogDescription>
          <div
            v-if="coverLetter?.jobApplication"
            class="flex items-center gap-2 mt-1"
          >
            <img
              v-if="coverLetter.jobApplication.companyLogoUrl"
              :src="coverLetter.jobApplication.companyLogoUrl"
              :alt="`${coverLetter.jobApplication.companyName} logo`"
              class="size-6 rounded object-cover"
            />
            <div
              v-else
              class="size-6 rounded bg-muted flex items-center justify-center"
            >
              <PhBuildings :size="12" class="text-muted-foreground" />
            </div>
            <span
              >{{ coverLetter.jobApplication.companyName }} -
              {{ coverLetter.jobApplication.position }}</span
            >
          </div>
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 py-4">
        <div v-if="isProcessing" class="flex items-center justify-center py-8">
          <PhSpinner :size="32" class="animate-spin" />
          <p class="ml-3 text-muted-foreground">{{ processingMessage }}</p>
        </div>

        <div v-else-if="coverLetter" class="space-y-4">
          <!-- View/Edit Toggle -->
          <div class="flex items-center justify-between">
            <div class="text-sm text-muted-foreground">
              Created {{ formatDate(coverLetter.createdAt) }}
              <span v-if="coverLetter.updatedAt">
                • Updated {{ formatDate(coverLetter.updatedAt) }}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              @click="isEditMode = !isEditMode"
            >
              <PhPencilSimple v-if="!isEditMode" />
              <PhEye v-else />
              {{ isEditMode ? "View" : "Edit" }}
            </Button>
          </div>

          <!-- Cover Letter Content -->
          <div
            v-if="!isEditMode"
            class="prose prose-sm max-w-none max-h-100 overflow-auto"
          >
            <div
              class="whitespace-pre-wrap bg-muted/30 rounded-lg p-6 text-foreground"
            >
              {{ localCoverLetterBody }}
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else>
            <textarea
              v-model="localCoverLetterBody"
              class="w-full min-h-[400px] px-4 py-3 text-sm rounded-md border border-input bg-background resize-none"
              placeholder="Your cover letter..."
            />
          </div>

          <!-- Error Message -->
          <Alert v-if="errorMessage" variant="destructive">
            <PhWarningCircle />
            <AlertDescription>
              {{ errorMessage }}
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button
          variant="outline"
          @click="copy(localCoverLetterBody)"
          :disabled="isSupported && !isSupported"
        >
          <PhCheck v-if="copied" />
          <PhCopy v-else />
          {{ copied ? "Copied!" : "Copy" }}
        </Button>
        <Button
          v-if="canRegenerate"
          variant="outline"
          @click="handleRegenerate"
          :disabled="isProcessing"
        >
          <PhArrowsClockwise />
          Regenerate
        </Button>
        <Button v-if="hasChanges" @click="handleSave" :disabled="isProcessing">
          <PhCheck />
          Save Changes
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>

  <Dialog v-model:open="isLimitDialogOpen">
    <DialogScrollContent>
      <DialogHeader>
        <DialogTitle>Regenerate cover letter</DialogTitle>
      </DialogHeader>
      <AiLimitReached
        v-if="allowance"
        :allowance="allowance"
        source="regenerate_cover_letter"
      />
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useClipboard } from "@vueuse/core";
import {
  PhArrowsClockwise,
  PhBuildings,
  PhCheck,
  PhCopy,
  PhEye,
  PhPencilSimple,
  PhSpinner,
  PhWarningCircle,
} from "@phosphor-icons/vue";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCoverLetters } from "@/composables/useCoverLetters";
import type { CoverLetter } from "@/types";
import { collection, doc, Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { useAiAllowance } from "@/composables/useAiAllowance";
import AiLimitReached from "@/components/AiLimitReached.vue";
import { useDocument } from "vuefire";
import { db } from "@/firebase/config.ts";
import { useRoute, useRouter } from "vue-router";
import { omit } from "lodash";

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
const isLimitDialogOpen = ref(false);

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
  processingMessage.value = "Saving changes...";
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
    isLimitDialogOpen.value = true;
    return;
  }

  isProcessing.value = true;
  processingMessage.value =
    "Regenerating cover letter... it may take 20-30 seconds.";
  errorMessage.value = "";

  const result = await regenerateCoverLetter(
    coverLetter.value?.id,
    coverLetter.value?.jobApplication.id,
    coverLetter.value?.resumeId,
  );

  isProcessing.value = false;

  if (result.success && result.data) {
    localCoverLetterBody.value = result.data.body;
    originalBody.value = result.data.body;
  } else {
    // @ts-expect-error error is present on failure result
    errorMessage.value = result.error || "Failed to regenerate cover letter";
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
        isLimitDialogOpen.value = false;
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
