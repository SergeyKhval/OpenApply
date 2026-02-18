import { useCurrentUser, useDocument, useFirebaseAuth } from "vuefire";
import {
  type Auth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential
} from "firebase/auth";
import { computed, type Ref } from "vue";
import { collection, doc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { identifyUser, resetUser, trackEvent } from "@/analytics";

type BillingProfile = {
  currentBalance: number;
  lifetimeCreditsPurchased: number;
  stripeCustomerId: string;
  welcomeCreditsGrantedAt?: unknown;
};

type UserProfileWithBilling<T = Record<string, unknown>> =
  | (T & { billingProfile?: BillingProfile | null })
  | null;

type AuthResult<T = User> =
  | { success: true; user: T }
  | { success: false; error: string };

type LogoutResult = { success: true } | { success: false; error: string };

export function useAuth() {
  const auth = useFirebaseAuth() as Auth | null;
  const user: Ref<User | null | undefined> = useCurrentUser();

  const userDocRef = computed(() =>
    user.value ? doc(collection(db, "users"), user.value.uid) : null,
  );
  const billingDocRef = computed(() =>
    user.value
      ? doc(collection(db, "users"), user.value.uid, "billingProfile", "profile")
      : null,
  );

  const userProfileDoc = useDocument(userDocRef);
  const billingProfileDoc = useDocument(billingDocRef);

  const userProfile = computed(() => {
    if (userProfileDoc.value === undefined) return undefined;

    if (!userProfileDoc.value) return userProfileDoc.value;

    return {
      ...userProfileDoc.value,
      billingProfile: billingProfileDoc.value ?? null,
    } as UserProfileWithBilling;
  });

  const login = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    if (!auth) return { success: false, error: "Auth not initialized" };

    try {
      const result: UserCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      identifyUser(result.user.uid, { email: result.user.email, authMethod: "email" });
      trackEvent("login_completed");
      return { success: true, user: result.user };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  };

  const register = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    if (!auth) return { success: false, error: "Auth not initialized" };

    try {
      const result: UserCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      identifyUser(result.user.uid, { email: result.user.email, authMethod: "email" });
      trackEvent("signup_completed");
      return { success: true, user: result.user };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  };

  const loginWithGoogle = async (): Promise<AuthResult> => {
    if (!auth) return { success: false, error: "Auth not initialized" };

    try {
      const provider = new GoogleAuthProvider();
      const result: UserCredential = await signInWithPopup(auth, provider);
      identifyUser(result.user.uid, { email: result.user.email, authMethod: "google" });
      trackEvent("login_completed");
      return { success: true, user: result.user };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  };

  const logout = async (): Promise<LogoutResult> => {
    if (!auth) return { success: false, error: "Auth not initialized" };

    try {
      await signOut(auth);
      resetUser();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  };

  return {
    user,
    userProfile,
    login,
    register,
    loginWithGoogle,
    logout,
  };
}
