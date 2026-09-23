import { watch } from "vue";
import type { User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/composables/useAuth";
import { readAcquisitionFromBrowser, type Acquisition } from "../../../shared/acquisition";

// Only attribute accounts created recently, so a returning user who lands via a
// new campaign link is not re-attributed to it.
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isNewAccount(user: Pick<User, "metadata">, now = Date.now()): boolean {
  const createdAt = Date.parse(user.metadata.creationTime ?? "");
  return Number.isFinite(createdAt) && now - createdAt < NEW_ACCOUNT_WINDOW_MS;
}

export function acquisitionToPersist(
  user: Pick<User, "isAnonymous" | "metadata"> | null | undefined,
  profile: Record<string, unknown> | null | undefined,
  storedAcquisition: Acquisition | null,
  now = Date.now(),
): Acquisition | null {
  if (!user || user.isAnonymous) return null;
  // undefined means the profile document has not loaded yet.
  if (profile === undefined || profile?.acquisition) return null;
  if (!isNewAccount(user, now)) return null;
  return storedAcquisition;
}

export function usePersistAcquisition() {
  const { user, userProfile } = useAuth();
  let persistedForUid: string | null = null;

  watch(
    [user, userProfile],
    async ([currentUser, profile]) => {
      if (!currentUser || persistedForUid === currentUser.uid) return;

      const acquisition = acquisitionToPersist(currentUser, profile, readAcquisitionFromBrowser());
      if (!acquisition) return;

      persistedForUid = currentUser.uid;
      try {
        await setDoc(doc(db, "users", currentUser.uid), { acquisition }, { merge: true });
      } catch (error) {
        console.error("Failed to save acquisition source:", error);
      }
    },
    { immediate: true },
  );
}
