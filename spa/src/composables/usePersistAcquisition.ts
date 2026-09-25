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

// Decides, one profile snapshot at a time, whether to write the acquisition
// now. Writes at most once per user, and never after a profile that existed
// disappears: that is the account being deleted, and a write would bring the
// profile back.
export function createAcquisitionGate() {
  let persistedForUid: string | null = null;
  let profileSeenForUid: string | null = null;

  return (
    user: (Pick<User, "isAnonymous" | "metadata"> & { uid: string }) | null | undefined,
    profile: Record<string, unknown> | null | undefined,
    storedAcquisition: Acquisition | null,
    now = Date.now(),
  ): Acquisition | null => {
    if (!user || persistedForUid === user.uid) return null;
    if (profile) profileSeenForUid = user.uid;
    else if (profile === null && profileSeenForUid === user.uid) return null;

    const acquisition = acquisitionToPersist(user, profile, storedAcquisition, now);
    if (acquisition) persistedForUid = user.uid;
    return acquisition;
  };
}

export function usePersistAcquisition() {
  const { user, userProfile } = useAuth();
  const nextWrite = createAcquisitionGate();

  watch(
    [user, userProfile],
    async ([currentUser, profile]) => {
      const acquisition = nextWrite(currentUser, profile, readAcquisitionFromBrowser());
      if (!currentUser || !acquisition) return;

      try {
        await setDoc(doc(db, "users", currentUser.uid), { acquisition }, { merge: true });
      } catch (error) {
        console.error("Failed to save acquisition source:", error);
      }
    },
    { immediate: true },
  );
}
