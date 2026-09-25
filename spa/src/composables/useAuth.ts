import { useCurrentUser, useDocument, useFirebaseAuth } from "vuefire";
import {
  type Auth,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential
} from "firebase/auth";
import { computed, type Ref } from "vue";
import { collection, doc, type Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { AllowanceProfile } from "@/lib/aiAllowance";
import { db, functions } from "@/firebase/config.ts";
import { identifyUser, resetUser, trackEvent } from "@/analytics";

type BillingProfile = AllowanceProfile & {
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Timestamp | null;
  cancelAtPeriodEnd?: boolean;
};

type UserProfileWithBilling<T = Record<string, unknown>> =
  | (T & { billingProfile?: BillingProfile | null })
  | null;

type AuthResult<T = User> =
  | { success: true; user: T }
  | { success: false; error: string; code?: string };

type LogoutResult = { success: true } | { success: false; error: string };

type AuthSource = "landing_page_parse" | "resume_match_tool" | "extension" | "direct";

// Firebase's raw error messages ("Firebase: Error (auth/popup-closed-by-user).")
// are not something to show a user.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
};

// Messages the sign-in code functions write for people to read
const CALLABLE_ERRORS_WITH_USER_MESSAGES = new Set([
  "functions/invalid-argument",
  "functions/resource-exhausted",
  "functions/permission-denied",
  "functions/internal",
]);

function friendlyCallableError(error: unknown): { message: string; code?: string } {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  if (code && message && CALLABLE_ERRORS_WITH_USER_MESSAGES.has(code)) {
    return { message, code };
  }
  return { message: "Something went wrong. Try again.", code };
}

function friendlyAuthError(error: unknown): { message: string; code?: string } {
  const code = (error as { code?: string })?.code;
  return { message: (code && AUTH_ERROR_MESSAGES[code]) || "Something went wrong. Try again.", code };
}

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

  const loginWithGoogle = async (
    options?: { source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct" },
  ): Promise<AuthResult> => {
    if (!auth) return { success: false, error: "Auth not initialized" };

    try {
      const provider = new GoogleAuthProvider();
      const result: UserCredential = await signInWithPopup(auth, provider);
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
      identifyUser(result.user.uid, { email: result.user.email, authMethod: "google" });
      const source = options?.source ?? "direct";
      trackEvent(isNewUser ? "signup_completed" : "login_completed", { source, method: "google" });
      return { success: true, user: result.user };
    } catch (error) {
      const { message, code } = friendlyAuthError(error);
      return { success: false, error: message, code };
    }
  };

  const sendSignInCode = async (
    email: string,
  ): Promise<{ success: true } | { success: false; error: string; code?: string }> => {
    try {
      await httpsCallable(functions, "sendSignInCode")({ email });
      return { success: true };
    } catch (error) {
      const { message, code } = friendlyCallableError(error);
      return { success: false, error: message, code };
    }
  };

  const verifySignInCode = async (
    email: string,
    code: string,
    options?: { source?: AuthSource },
  ): Promise<AuthResult> => {
    if (!auth) return { success: false, error: "Auth not initialized" };

    try {
      const verify = httpsCallable<{ email: string; code: string }, { token: string; isNewUser: boolean }>(
        functions,
        "verifySignInCode",
      );
      const { data } = await verify({ email, code });
      const result = await signInWithCustomToken(auth, data.token);
      identifyUser(result.user.uid, { email: result.user.email, authMethod: "email_code" });
      trackEvent(data.isNewUser ? "signup_completed" : "login_completed", {
        source: options?.source ?? "direct",
        method: "email_code",
      });
      return { success: true, user: result.user };
    } catch (error) {
      const { message, code: errorCode } = friendlyCallableError(error);
      return { success: false, error: message, code: errorCode };
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
    loginWithGoogle,
    sendSignInCode,
    verifySignInCode,
    logout,
  };
}
