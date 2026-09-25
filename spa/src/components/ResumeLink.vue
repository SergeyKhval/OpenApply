<template>
  <!-- The name always shows; it becomes a link once the file's url loads -->
  <a
    v-if="url"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="font-bold break-all text-foreground hover:underline"
  >
    {{ resume.fileName || "Resume" }}
  </a>
  <span v-else class="font-bold break-all text-foreground">{{ resume.fileName || "Resume" }}</span>
</template>


<script setup lang="ts">
import { useStorageFileUrl, useFirebaseStorage } from "vuefire";
import { ref as storageRef } from "firebase/storage";
import { Resume } from "@/types";

type ResumeLinkProps = {
  resume: Resume;
};

const { resume } = defineProps<ResumeLinkProps>();
const storage = useFirebaseStorage();
const resumeStorageRef = storageRef(storage, resume.storagePath);
const { url } = useStorageFileUrl(resumeStorageRef);
</script>
