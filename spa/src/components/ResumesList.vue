<template>
  <div class="w-full">
    <div
      v-if="resumes && resumes.length > 0"
      class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <Card v-for="resume in resumes" :key="resume.id" class="relative">
        <Button
          size="sm"
          variant="secondary"
          class="absolute right-2 top-2"
          @click="handleDelete(resume)"
          :disabled="deletingIds.includes(resume.id)"
        >
          <PhTrash :size="16" />
        </Button>
        <CardContent class="flex flex-col gap-1 mb-3">
          <div class="flex items-start gap-3">
            <PhFilePdf :size="36" class="shrink-0 text-primary" />
            <div class="flex flex-col gap-1">
              <a
                :href="resume.url"
                target="_blank"
                class="text-xl text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                <span class="break-all">
                  {{ resume.fileName || "Resume" }}
                </span>
              </a>
              <p class="text-muted-foreground text-xs">
                {{ formatFileSize(resume.fileSize) }} •
                {{ formatDate(resume.createdAt) }}
              </p>
              <p
                v-if="resume.status === 'parsed'"
                class="flex items-center text-xs gap-1 mt-2"
              >
                <PhEnvelopeSimple class="text-emerald-500" :size="16" />

                Ready for cover letters
              </p>
            </div>
          </div>
          <Alert
            v-if="resume.status === 'parse-failed'"
            variant="destructive"
            class="mt-3"
          >
            <PhXCircle class="text-red-500" weight="fill" :size="16" />
            <AlertDescription>
              Parsing Error, try uploading again
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
    <Empty v-else class="py-12">
      <EmptyIcon>
        <PhFilePdf :size="32" />
      </EmptyIcon>
      <div class="space-y-2">
        <EmptyTitle>No resumes uploaded yet</EmptyTitle>
        <EmptyDescription>
          Click the "Upload New Resume" button to add your first resume
        </EmptyDescription>
      </div>
      <EmptyAction>
        <UploadResumeButton>Upload First Resume</UploadResumeButton>
      </EmptyAction>
    </Empty>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useCollection, useCurrentUser, useFirebaseStorage } from "vuefire";
import {
  collection,
  query,
  where,
  doc,
  writeBatch,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import {
  PhEnvelopeSimple,
  PhFilePdf,
  PhTrash,
  PhXCircle,
} from "@phosphor-icons/vue";
import type { Resume } from "@/types";
import { db } from "@/firebase/config.ts";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyAction,
  EmptyDescription,
  EmptyIcon,
  EmptyTitle,
} from "@/components/ui/empty";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const user = useCurrentUser();
const storage = useFirebaseStorage();
const deletingIds = ref<string[]>([]);

const q = computed(() =>
  user.value
    ? query(
        collection(db, "userResumes"),
        where("userId", "==", user.value?.uid),
        orderBy("createdAt", "desc"),
      )
    : null,
);

const { data: resumes } = useCollection<Resume>(q);

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return bytes + " B";
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(2) + " KB";
  const mb = kb / 1024;
  return mb.toFixed(2) + " MB";
};

const formatDate = (timestamp: any): string => {
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

const handleDelete = async (resume: Resume) => {
  deletingIds.value.push(resume.id);

  try {
    // First, check if this resume is linked to any job applications
    const linkedApplicationsQuery = query(
      collection(db, "jobApplications"),
      where("resumeId", "==", resume.id),
      where("userId", "==", user.value?.uid),
    );

    const linkedApplicationsSnapshot = await getDocs(linkedApplicationsQuery);
    const applicationCount = linkedApplicationsSnapshot.size;

    // Build confirmation message based on whether there are linked applications
    let confirmMessage = `Are you sure you want to delete "${resume.fileName}"?`;

    if (applicationCount > 0) {
      confirmMessage += `\n\nThis resume is linked to ${applicationCount} job application${applicationCount > 1 ? "s" : ""}. `;
      confirmMessage += `Deleting it will remove the resume link from ${applicationCount > 1 ? "these applications" : "this application"}.`;
    }

    // Single confirmation dialog
    if (!confirm(confirmMessage)) {
      deletingIds.value = deletingIds.value.filter((id) => id !== resume.id);
      return;
    }

    // Use a batch to ensure all operations succeed or fail together
    const batch = writeBatch(db);

    // Unlink resume from all job applications
    linkedApplicationsSnapshot.forEach((applicationDoc) => {
      const applicationRef = doc(db, "jobApplications", applicationDoc.id);
      batch.update(applicationRef, { resumeId: null });
    });

    // Delete the resume document from Firestore
    const resumeRef = doc(db, "userResumes", resume.id);
    batch.delete(resumeRef);

    // Commit all Firestore changes
    await batch.commit();

    // Delete from Firebase Storage (do this after Firestore operations succeed)
    if (resume.storagePath) {
      const fileRef = storageRef(storage, resume.storagePath);
      await deleteObject(fileRef);
    }
  } catch (error) {
    console.error("Error deleting resume:", error);
  } finally {
    deletingIds.value = deletingIds.value.filter((id) => id !== resume.id);
  }
};
</script>
