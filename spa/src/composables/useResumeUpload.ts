import { ref, computed, watch } from "vue";
import { useCurrentUser, useFirebaseStorage, useStorageFile } from "vuefire";
import { ref as storageRef } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useFileDialog } from "@vueuse/core";
import { useToast } from "@/components/ui/toast";
import { db } from "@/firebase/config";

const MAX_FILE_SIZE = 500 * 1024; // 500KB in bytes

export function useResumeUpload() {
  const user = useCurrentUser();
  const storage = useFirebaseStorage();
  const { toast } = useToast();

  const isUploading = ref(false);

  const { open, onChange, reset } = useFileDialog({
    accept: "application/pdf",
    multiple: false,
  });

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!user.value) {
      return {
        valid: false,
        error: "Sign in to upload and store your resume.",
      };
    }

    if (file.type !== "application/pdf") {
      return {
        valid: false,
        error: "Please upload your resume as a PDF file.",
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: "Resumes must be 500 KB or smaller.",
      };
    }

    return { valid: true };
  };

  const uploadResume = async (
    file: File,
  ): Promise<{ success: boolean; resumeId?: string }> => {
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        title: "Upload failed",
        description: validation.error,
        variant: "destructive",
      });
      return { success: false };
    }

    if (!user.value) {
      return { success: false };
    }

    isUploading.value = true;

    try {
      const fileRef = storageRef(
        storage,
        `resumes/${user.value.uid}/${Date.now()}-${file.name}`,
      );

      const { url, upload: uploadFile, metadata } = useStorageFile(fileRef);

      const uploadTask = uploadFile?.(file);
      if (!uploadTask) {
        throw new Error("Failed to start upload");
      }

      await uploadTask;

      // Wait for URL to be available
      const stopWatching = watch([url, metadata], async ([resumeUrl, meta]) => {
        if (resumeUrl && meta && user.value) {
          stopWatching();

          // Create Firestore document
          await addDoc(collection(db, "userResumes"), {
            userId: user.value.uid,
            fileName: file.name,
            fileSize: file.size,
            url: resumeUrl,
            status: "uploaded",
            storagePath: meta.fullPath,
            createdAt: serverTimestamp(),
          });

          isUploading.value = false;

          toast({
            title: "Resume uploaded",
            description: `${file.name} has been uploaded successfully.`,
          });
        }
      });

      return { success: true };
    } catch (err) {
      isUploading.value = false;

      const errorMessage =
        err instanceof Error ? err.message : "We couldn't upload your resume.";

      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false };
    }
  };

  const openFileDialog = () => {
    if (!isUploading.value) {
      open();
    }
  };

  onChange(async (fileList) => {
    const file = fileList?.item(0);
    if (!file) return;

    await uploadResume(file);
    reset();
  });

  const uploadFile = async (file: File) => {
    return uploadResume(file);
  };

  return {
    isUploading: computed(() => isUploading.value),
    openFileDialog,
    uploadFile,
    validateFile,
    MAX_FILE_SIZE,
  };
}

export { MAX_FILE_SIZE as RESUME_MAX_FILE_SIZE };
