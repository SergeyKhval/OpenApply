import { computed } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import { collection, deleteDoc, doc, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/config";
import type { CoverLetter } from "@/types";

type CoverLetterActionError = {
  success: false;
  error: string;
  code?: string;
};

type GenerateCoverLetterSuccess = {
  success: true;
  data: { coverLetterId: string; body: string };
};

type GenerateCoverLetterResult = GenerateCoverLetterSuccess | CoverLetterActionError;

type RegenerateCoverLetterSuccess = {
  success: true;
  data: { body: string };
};

type RegenerateCoverLetterResult =
  | RegenerateCoverLetterSuccess
  | CoverLetterActionError;

const normalizeFunctionsError = (error: unknown): CoverLetterActionError => {
  const fallbackMessage = "An unexpected error occurred";
  if (!error || typeof error !== "object") {
    return { success: false, error: fallbackMessage };
  }

  const maybeError = error as {
    code?: string;
    message?: string;
    details?: unknown;
  };

  const message =
    typeof maybeError.message === "string" && maybeError.message.length
      ? maybeError.message
      : fallbackMessage;

  let normalizedCode =
    typeof maybeError.code === "string" &&
    maybeError.code.startsWith("functions/")
      ? maybeError.code.replace("functions/", "")
      : undefined;

  if (
    maybeError.details &&
    typeof maybeError.details === "object" &&
    "code" in maybeError.details
  ) {
    const detailCode = (maybeError.details as { code?: string }).code;
    if (detailCode) {
      normalizedCode = detailCode;
    }
  }

  return { success: false, error: message, code: normalizedCode };
};

export function useCoverLetters() {
  const user = useCurrentUser();

  const coverLettersQuery = computed(() =>
    user.value
      ? query(
          collection(db, "coverLetters"),
          where("userId", "==", user.value.uid),
          orderBy("createdAt", "desc")
        )
      : null
  );

  const { data: coverLetters, pending: isLoading } = useCollection<CoverLetter>(coverLettersQuery);

  const generateCoverLetter = async (
    jobApplicationId: string,
    resumeId: string,
    manualJobDescription?: string
  ): Promise<GenerateCoverLetterResult> => {
    if (!user.value) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const generateFunction = httpsCallable(functions, "generateCoverLetter");
      const result = await generateFunction({
        jobApplicationId,
        resumeId,
        manualJobDescription,
      });

      const data = result.data as { coverLetterId: string; body: string };
      return { success: true, data };
    } catch (err) {
      console.error("Error generating cover letter:", err);
      return normalizeFunctionsError(err);
    }
  };

  const updateCoverLetter = async (
    coverLetterId: string,
    body: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user.value) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const docRef = doc(db, "coverLetters", coverLetterId);
      await updateDoc(docRef, {
        body,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      console.error("Error updating cover letter:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  const deleteCoverLetter = async (
    coverLetterId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user.value) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const docRef = doc(db, "coverLetters", coverLetterId);
      await deleteDoc(docRef);

      return { success: true };
    } catch (err) {
      console.error("Error deleting cover letter:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  const regenerateCoverLetter = async (
    coverLetterId: string,
    jobApplicationId: string,
    resumeId: string,
    manualJobDescription?: string
  ): Promise<RegenerateCoverLetterResult> => {
    if (!user.value) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const regenerateFunction = httpsCallable(functions, "regenerateCoverLetter");
      const result = await regenerateFunction({
        coverLetterId,
        jobApplicationId,
        resumeId,
        manualJobDescription,
      });

      const data = result.data as { body: string };
      return { success: true, data };
    } catch (err) {
      console.error("Error regenerating cover letter:", err);
      return normalizeFunctionsError(err);
    }
  };

  return {
    coverLetters,
    isLoading,
    generateCoverLetter,
    updateCoverLetter,
    deleteCoverLetter,
    regenerateCoverLetter,
  };
}