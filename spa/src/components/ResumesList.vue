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
            <PhFileText v-if="resume.kind === 'built'" :size="22" />
            <PhFilePdf v-else :size="22" />
          </span>
          <div class="flex min-w-0 grow basis-60 flex-col gap-0.5">
            <ResumeLink :resume="resume" />
            <p class="text-sm text-muted-foreground">
              <template v-if="resume.kind === 'built'">{{ madeFrom(resume) ? `Made from ${madeFrom(resume)} ·` : "Made here" }} {{ formatDate(resume.createdAt) }}</template>
              <template v-else>Uploaded {{ formatDate(resume.createdAt) }}<template v-if="resume.fileSize"> · {{ formatFileSize(resume.fileSize) }}</template></template>
            </p>
          </div>
          <!-- A built resume's text is written by the app, nothing to read -->
          <template v-if="resume.kind === 'built'" />
          <Badge v-else-if="resume.status === 'parsed'" variant="success"><PhCheck weight="bold" />Read OK</Badge>
          <Badge v-else-if="resume.status === 'parse-failed'" variant="destructive"><PhX weight="bold" />Couldn't read it</Badge>
          <Badge v-else variant="secondary">Reading…</Badge>
          <RouterLink
            v-if="usage.get(resume.id)"
            to="/jobs"
            class="text-sm font-semibold text-secondary-foreground underline underline-offset-2 sm:w-32"
          >
            {{ usageLabel(usage.get(resume.id) ?? 0) }}
          </RouterLink>
          <span v-else class="text-sm text-muted-foreground sm:w-32">{{ usageLabel(0) }}</span>
          <!-- The file name opens the PDF; the menu holds the rest (canvas "Documents") -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="ml-auto"
                :aria-label="`Options for ${resumeName(resume)}`"
                :disabled="deletingIds.includes(resume.id)"
              >
                <PhDotsThree :size="18" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RebuildResumeMenuItem :resume="resume" />
              <DropdownMenuItem variant="destructive" @select="handleDelete(resume)"><PhTrash />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p v-if="resume.status === 'parse-failed'" class="basis-full text-sm text-destructive sm:pl-15">
            We couldn't read the text in this PDF, so matches won't work with it. Try exporting it again and uploading the new file.
          </p>
          <TailoredVersionsList
            v-if="tailoredByResume.get(resume.id)?.length"
            class="basis-full sm:pl-15"
            :versions="tailoredByResume.get(resume.id) ?? []"
            :deleting="isDeletingTailored"
            @open="openTailored(resume, $event)"
            @delete="deleteTailored"
          />
        </li>
      </ul>
      <p v-if="resumes.some((resume) => resume.kind !== 'built')" class="flex items-center gap-2 text-sm text-muted-foreground">
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
        <NewResumeButton surface="resumes_empty" variant="outline">Build one here</NewResumeButton>
      </EmptyAction>
    </Empty>
    <TailoredResumeSheet
      v-if="tailoringEnabled && openVersion"
      v-model:open="isTailoredOpen"
      :resume="openVersion.resume"
      :application="openVersion.application"
    />
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
import { PhCheck, PhDotsThree, PhFilePdf, PhFileText, PhInfo, PhTrash, PhX } from "@phosphor-icons/vue";
import type { Resume, TailoredResume } from "@/types";
import { db } from "@/firebase/config.ts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyAction,
  EmptyDescription,
  EmptyIcon,
  EmptyTitle,
} from "@/components/ui/empty";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
import NewResumeButton from "@/components/resume-builder/NewResumeButton.vue";
import RebuildResumeMenuItem from "@/components/resume-builder/RebuildResumeMenuItem.vue";
import { Badge } from "@/components/ui/badge";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { countResumeUsage, formatFileSize, resumeName, usageLabel } from "@/lib/resumeUsage";
import ResumeLink from "@/components/ResumeLink.vue";
import TailoredVersionsList, { type TailoredVersionEntry } from "@/components/TailoredVersionsList.vue";
import TailoredResumeSheet from "@/components/ai/TailoredResumeSheet.vue";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { newestTailoredPerJob } from "@/lib/tailoredResume";

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

// "Made from sarah.pdf" for a resume copied from an upload that's still here
function madeFrom(resume: Resume): string {
  if (resume.kind !== "built" || !resume.importedFrom?.resumeId) return "";
  const source = resumes.value?.find((candidate) => candidate.id === resume.importedFrom?.resumeId);
  return source && source.kind !== "built" ? source.fileName : "";
}

// Tailored versions (flag tailored-resume): one query for all of them,
// newest per job under each resume
const tailoringEnabled = useFeatureFlag("tailored-resume");
const tailoredQuery = computed(() =>
  user.value && tailoringEnabled.value
    ? query(collection(db, "tailoredResumes"), where("userId", "==", user.value.uid), orderBy("createdAt", "desc"))
    : null,
);
const tailoredVersions = useCollection<TailoredResume>(tailoredQuery);
const tailoredByResume = computed(() => newestTailoredPerJob(tailoredVersions.value ?? []));

const isTailoredOpen = ref(false);
const openVersion = ref<{ resume: Resume; application: { id: string; companyName: string; position: string } } | null>(null);
function openTailored(resume: Resume, version: TailoredVersionEntry) {
  openVersion.value = {
    resume,
    application: {
      id: version.jobApplicationId,
      companyName: version.jobApplication.companyName ?? "",
      position: version.jobApplication.position ?? "",
    },
  };
  isTailoredOpen.value = true;
}

const isDeletingTailored = ref(false);
// Deletes every tailored version of this resume for this job, so an older
// one doesn't take its place
async function deleteTailored(version: TailoredVersionEntry) {
  isDeletingTailored.value = true;
  try {
    const batch = writeBatch(db);
    (tailoredVersions.value ?? [])
      .filter((candidate) => candidate.resumeId === version.resumeId && candidate.jobApplicationId === version.jobApplicationId)
      .forEach((candidate) => batch.delete(doc(db, "tailoredResumes", candidate.id)));
    await batch.commit();
  } catch (error) {
    console.error("Error deleting tailored versions:", error);
  } finally {
    isDeletingTailored.value = false;
  }
}

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
    let confirmMessage = `Are you sure you want to delete "${resumeName(resume)}"?`;

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

    // Delete from Firebase Storage (do this after Firestore operations succeed).
    // A built resume has no file.
    if (resume.kind !== "built" && resume.storagePath) {
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
