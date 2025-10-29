<template>
  <Button v-if="showTrigger" :disabled="isUploading" @click="openFileDialog">
    <PhSpinner v-if="isUploading" class="animate-spin" />
    <PhFileArrowUp v-else />
    <slot>Upload <span class="hidden lg:inline">New Resume</span></slot>
  </Button>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useFileDialog } from "@vueuse/core";
import { useCurrentUser, useFirebaseStorage, useStorageFile } from "vuefire";
import { ref as storageRef } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { PhFileArrowUp, PhSpinner } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { db } from "@/firebase/config.ts";

const { showTrigger = true } = defineProps<{ showTrigger?: boolean }>();

const DEFAULT_TOAST_DURATION = 5000;
const MAX_FILE_SIZE = 500 * 1024; // 500KB in bytes

const user = useCurrentUser();
const storage = useFirebaseStorage();
const isUploading = ref(false);
const { toast } = useToast();
const emit = defineEmits<{ (event: "uploaded", resumeId: string): void }>();

const { open, onChange, reset } = useFileDialog({
  accept: "application/pdf",
  multiple: false,
});

const openFileDialog = () => {
  if (!isUploading.value) {
    open();
  }
};

onChange((files) => {
  const file = files?.item(0);

  if (!file) return;
  if (!user.value) {
    toast({
      title: "Sign in required",
      description: "Sign in to upload and store your resume.",
      variant: "destructive",
      duration: DEFAULT_TOAST_DURATION,
    });
    reset();
    return;
  }
  if (file.type !== "application/pdf") {
    toast({
      title: "Unsupported file type",
      description: "Please upload your resume as a PDF file.",
      variant: "destructive",
      duration: DEFAULT_TOAST_DURATION,
    });
    reset();
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    toast({
      title: "File is too large",
      description:
        "Resumes must be 500 KB or smaller. Reduce the file size and try again.",
      variant: "destructive",
      duration: DEFAULT_TOAST_DURATION,
    });
    reset();
    return;
  }

  isUploading.value = true;

  const fileRef = storageRef(
    storage,
    `resumes/${user.value.uid}/${Date.now()}-${file.name}`,
  );
  const { url, upload: uploadFile, metadata } = useStorageFile(fileRef);

  const stopWatching = watch(url, async (resumeUrl) => {
    if (resumeUrl && user.value && metadata.value) {
      try {
        const docRef = await addDoc(collection(db, "userResumes"), {
          userId: user.value.uid,
          fileName: file.name,
          fileSize: file.size,
          url: resumeUrl,
          status: "uploaded",
          storagePath: metadata.value.fullPath,
          createdAt: serverTimestamp(),
        });
        emit("uploaded", docRef.id);
      } catch (error) {
        console.error("Firestore error:", error);
      } finally {
        isUploading.value = false;
      }
      stopWatching();
      reset();
    }
  });

  if (!uploadFile) {
    isUploading.value = false;
    stopWatching();
    reset();
    return;
  }

  const uploadTask = uploadFile(file);

  if (!uploadTask) {
    isUploading.value = false;
    stopWatching();
    reset();
    toast({
      title: "Upload failed",
      description:
        "Something went wrong while starting the upload. Please try again.",
      variant: "destructive",
      duration: DEFAULT_TOAST_DURATION,
    });
    return;
  }

  uploadTask.catch(() => {
    isUploading.value = false;
    stopWatching();
    reset();
    toast({
      title: "Upload failed",
      description: "We couldn't upload your resume. Please try again.",
      variant: "destructive",
      duration: DEFAULT_TOAST_DURATION,
    });
  });
});

// todo: extract upload logic to composable
defineExpose({ openFileDialog });
</script>
