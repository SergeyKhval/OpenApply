<template>
  <a
    v-if="url"
    :href="url"
    target="_blank"
    class="text-xl text-primary hover:text-primary/80 hover:underline transition-colors"
  >
    <span class="break-all">
      {{ resume.fileName || "Resume" }}
    </span>
  </a>
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
