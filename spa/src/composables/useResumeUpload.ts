import { ref } from "vue";
import { useCurrentUser, useFirebaseStorage, useStorageFile } from "vuefire";
import { ref as storageRef } from "firebase/storage";
import { useFileDialog } from "@vueuse/core";
import { useToast } from "@/components/ui/toast";
import { User } from "firebase/auth";
import { trackEvent } from "@/analytics";

const MAX_FILE_SIZE = 500 * 1024; // 500KB in bytes
export const validateFile = (
  file: File,
  user?: User | null,
): { valid: boolean; error?: string } => {
  if (!user) {
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

export function useResumeUpload() {
  const user = useCurrentUser();
  const storage = useFirebaseStorage();
  const { toast } = useToast();

  const isUploading = ref(false);

  const {
    open: openFileDialog,
    onChange,
    reset,
  } = useFileDialog({
    accept: "application/pdf",
    multiple: false,
  });

  onChange(async (fileList) => {
    const file = fileList?.item(0);
    if (!file) return;

    await uploadResume(file);
    reset();
  });

  const uploadResume = async (file: File) => {
    isUploading.value = true;

    const validation = validateFile(file, user.value);
    if (!validation.valid) {
      toast({
        title: "Upload failed",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    if (!user.value) {
      return;
    }

    try {
      const fileRef = storageRef(
        storage,
        `resumes/${user.value.uid}/${Date.now()}-${file.name}`,
      );

      const { upload: uploadFile } = useStorageFile(fileRef);

      await uploadFile(file);
      trackEvent("resume_uploaded");

      isUploading.value = false;
    } catch (err) {
      isUploading.value = false;

      const errorMessage =
        err instanceof Error ? err.message : "We couldn't upload your resume.";
      trackEvent("resume_upload_failed", { error: errorMessage });

      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return {
    isUploading,
    openFileDialog,
  };
}
