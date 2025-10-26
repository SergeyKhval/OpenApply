<template>
  <Dialog :open="isOpen" @update:open="handleOpenChange">
    <DialogScrollContent class="md:min-w-200">
      <DialogHeader>
        <DialogTitle>Choose Resume</DialogTitle>
        <DialogDescription>
          Select a resume to attach to this job application
        </DialogDescription>
      </DialogHeader>

      <!-- Loading state -->
      <div v-if="!resumes" class="space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-20 w-full" />
      </div>

      <!-- Empty state -->
      <Empty v-else-if="resumes.length === 0" class="py-8">
        <EmptyIcon>
          <PhFilePdf :size="32" />
        </EmptyIcon>
        <div class="space-y-2">
          <EmptyTitle>No resumes uploaded yet</EmptyTitle>
          <EmptyDescription>
            Upload your first resume to attach it to this application
          </EmptyDescription>
        </div>
        <EmptyAction>
          <UploadResumeButton> Upload Resume </UploadResumeButton>
        </EmptyAction>
      </Empty>

      <!-- Resume list -->
      <div
        v-else
        class="flex flex-col w-full gap-4 sm:max-h-150 sm:overflow-y-auto"
      >
        <!-- Upload button at top when resumes exist -->
        <div class="flex justify-end">
          <UploadResumeButton> Upload New Resume </UploadResumeButton>
        </div>

        <!-- Scrollable list -->
        <div class="grid md:grid-cols-2 gap-4">
          <div
            v-for="resume in resumes"
            :key="resume.id"
            class="flex flex-col items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div class="flex gap-4">
              <PhFilePdf :size="32" class="shrink-0 text-primary mt-1" />

              <div class="flex items-start justify-between gap-2 grow">
                <div class="min-w-0 flex-1">
                  <p class="font-medium break-all">
                    {{ resume.fileName }}
                  </p>
                  <p
                    v-if="resume.id === currentResumeId"
                    class="text-sm flex items-center gap-1 text-muted-foreground font-normal mb-2"
                  >
                    <PhCheckFat
                      weight="fill"
                      class="text-emerald-500"
                    />(Currently attached)
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {{ formatFileSize(resume.fileSize) }} •
                    {{ formatDate(resume.createdAt) }}
                  </p>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                variant="default"
                @click="handleSelect(resume.id)"
                :disabled="isSelecting"
              >
                Select
              </Button>
              <Button
                size="sm"
                variant="ghost"
                as="a"
                :href="resume.url"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
              >
                View
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PhCheckFat, PhFilePdf } from "@phosphor-icons/vue";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyAction,
  EmptyDescription,
  EmptyIcon,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
import { useResumes } from "@/composables/useResumes";
import { useJobApplications } from "@/composables/useJobApplications";
import { useToast } from "@/components/ui/toast";
import type { Timestamp } from "firebase/firestore";
import { useRoute, useRouter } from "vue-router";
import omit from "lodash/omit";

type ResumePickerDialogProps = {
  isOpen: boolean;
};

const { isOpen } = defineProps<ResumePickerDialogProps>();

const router = useRouter();
const route = useRoute();

const applicationId = computed(() => route.query["application-id"] as string);
const currentResumeId = computed(() => route.query["resume-id"] as string);
const resumes = useResumes();
const { updateJobApplication } = useJobApplications();
const { toast } = useToast();
const isSelecting = ref(false);

const handleOpenChange = (isOpen: boolean) => {
  if (!isOpen) {
    router.replace({
      query: omit(route.query, ["dialog-name", "application-id"]),
    });
  }
};

const handleSelect = async (resumeId: string) => {
  isSelecting.value = true;

  try {
    const result = await updateJobApplication(applicationId.value, {
      resumeId,
    });

    if (result.success) {
      // Close modal on success
      handleOpenChange(false);
    } else {
      // Show error toast and keep modal open
      toast({
        title: "Failed to attach resume",
        description: result.error || "An error occurred. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  } catch (error) {
    console.error("Error selecting resume:", error);
    toast({
      title: "Failed to attach resume",
      description: "An unexpected error occurred. Please try again.",
      variant: "destructive",
      duration: 5000,
    });
  } finally {
    isSelecting.value = false;
  }
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return bytes + " B";
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(2) + " KB";
  const mb = kb / 1024;
  return mb.toFixed(2) + " MB";
};

const formatDate = (timestamp: Timestamp | any): string => {
  if (!timestamp) return "N/A";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
};
</script>
