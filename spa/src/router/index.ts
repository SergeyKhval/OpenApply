import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/firebase/config";
import { usePostHog } from "@/composables/usePostHog.ts";

let currentUser: User | null = auth.currentUser;
let isAuthResolved = Boolean(currentUser);
let authInitializationPromise: Promise<User | null> | null = null;

const waitForInitialAuthState = (): Promise<User | null> => {
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    isAuthResolved = true;
    return Promise.resolve(currentUser);
  }

  if (isAuthResolved) {
    return Promise.resolve(currentUser);
  }

  if (!authInitializationPromise) {
    authInitializationPromise = new Promise<User | null>((resolve) => {
      const stopListening = onAuthStateChanged(
        auth,
        (user) => {
          currentUser = user;
          isAuthResolved = true;
          authInitializationPromise = null;
          stopListening();
          resolve(user);
        },
        () => {
          currentUser = null;
          isAuthResolved = true;
          authInitializationPromise = null;
          stopListening();
          resolve(null);
        },
      );
    });
  }

  return authInitializationPromise;
};

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAuthResolved = true;
});

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_URL || "/app"),
  routes,
});

router.beforeEach(async (to) => {
  if (!to.matched.some((record) => record.meta.requiresAuth)) {
    return true;
  }

  const user = await waitForInitialAuthState();

  if (user) {
    if (to.matched.some((record) => record.meta.requiresAdmin)) {
      return user.email === import.meta.env.VITE_ADMIN_EMAIL;
    }
    return true;
  }

  return { path: "/" };
});

if (import.meta.env.VITE_PUBLIC_POSTHOG_API_KEY)
  usePostHog(
    import.meta.env.VITE_PUBLIC_POSTHOG_API_KEY,
    import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  );

export default router;
