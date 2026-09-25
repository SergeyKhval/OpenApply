<template>
  <div class="w-full">
    <div
      v-if="resumes && resumes.length > 0"
      class="flex flex-col gap-3"
    >
      <ul class="overflow-hidden rounded-card bg-card shadow-card dark:border dark:border-border">
        <li
          v-for="resume in resumes"
          :key="resume.id"
          class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-4 last:border-0"
        >
          <span class="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <PhFilePdf :size="22" />
          </span>
          <div class="flex min-w-0 grow basis-60 flex-col gap-0.5">
            <ResumeLink :resume="resume" />
            <p class="text-sm text-muted-foreground">
              Uploaded {{ formatDate(resume.createdAt) }}<template v-if="resume.fileSize"> · {{ formatFileSize(resume.fileSize) }}</template>
            </p>
          </div>
          <Badge v-if="resume.status === 'parsed'" variant="success"><PhCheck weight="bold" />Read OK</Badge>
          <Badge v-else-if="resume.status === 'parse-failed'" variant="destructive"><PhX weight="bold" />Couldn't read it</Badge>
          <Badge v-else variant="secondary">Reading…</Badge>
          <RouterLink
            v-if="usage.get(resume.id)"
            to="/jobs"
            class="text-sm font-semibold text-secondary-foreground hover:underline sm:w-32"
          >
            {{ usageLabel(usage.get(resume.id) ?? 0) }}
          </RouterLink>
          <span v-else class="text-sm text-muted-foreground sm:w-32">{{ usageLabel(0) }}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            class="ml-auto"
            :aria-label="`Delete ${resume.fileName}`"
            :disabled="deletingIds.includes(resume.id)"
            @click="handleDelete(resume)"
          >
            <PhTrash :size="18" />
          </Button>
          <p v-if="resume.status === 'parse-failed'" class="basis-full text-sm text-destructive sm:pl-15">
            We couldn't read the text in this PDF, so matches won't work with it. Try exporting it again and uploading the new file.
          </p>
        </li>
      </ul>
      <p class="flex items-center gap-2 text-sm text-muted-foreground">
        <PhInfo :size="16" />
        Read OK means we could read the text in the PDF. That text is what the resume match uses.
      </p>
    </div>
    <Empty v-else class="py-12">
      <EmptyIcon>
        <PhFilePdf :size="32" />
      </EmptyIcon>
      <div class="space-y-2">
        <EmptyTitle>No resumes yet</EmptyTitle>
        <EmptyDescription>
          Upload a PDF to check it against jobs and keep track of which version you sent where.
        </EmptyDescription>
      </div>
      <EmptyAction>
        <UploadResumeButton>Upload your resume</UploadResumeButton>
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
import { PhCheck, PhFilePdf, PhInfo, PhTrash, PhX } from "@phosphor-icons/vue";
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
import { Badge } from "@/components/ui/badge";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { countResumeUsage, formatFileSize, usageLabel } from "@/lib/resumeUsage";
import ResumeLink from "@/components/ResumeLink.vue";

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

const { jobApplications } = useJobApplicationsData();
const usage = computed(() => countResumeUsage(jobApplications.value ?? []));

const formatDate = (timestamp: any): string => {
  if (!timestamp) return "N/A";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
