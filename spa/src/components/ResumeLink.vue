<template>
  <!-- The name always shows; it becomes a link once the file's url loads -->
  <a
    v-if="url"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="font-bold break-all text-foreground hover:underline"
  >
    {{ resumeName(resume) }}
  </a>
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
// A built resume has no file: it shows as plain text
const { url } = useStorageFileUrl(resume.kind === "built" ? null : storageRef(storage, resume.storagePath));
</script>
