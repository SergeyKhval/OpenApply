<template>
  <!-- The name always shows; it links to the file once its url loads, or to
       the editor for a built resume -->
  <a
    v-if="url"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="font-bold break-all text-foreground hover:underline"
  >
    {{ resumeName(resume) }}
  </a>
  <RouterLink
    v-else-if="resume.kind === 'built'"
    :to="{ name: '/documents/resumes/[resumeId]', params: { resumeId: resume.id } }"
    class="font-bold break-all text-foreground hover:underline"
  >
    {{ resumeName(resume) }}
  </RouterLink>
  <span v-else class="font-bold break-all text-foreground">{{ resumeName(resume) }}</span>
</template>


<script setup lang="ts">
import { useStorageFileUrl, useFirebaseStorage } from "vuefire";
import { ref as storageRef } from "firebase/storage";
import { Resume } from "@/types";
import { resumeName } from "@/lib/resumeUsage";

type ResumeLinkProps = {
  resume: Resume;
};

const { resume } = defineProps<ResumeLinkProps>();
const storage = useFirebaseStorage();
// A built resume has no file: it links to the editor instead
const { url } = useStorageFileUrl(resume.kind === "built" ? null : storageRef(storage, resume.storagePath));
</script>
