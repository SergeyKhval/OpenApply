import { createApp } from "vue";
import { VueFire, VueFireAuth } from "vuefire";
import { createPinia } from "pinia";
import "./index.css";
import App from "./App.vue";
import router from "./router";
import firebaseApp, { auth } from "./firebase/config";
import { captureFirstTouchInBrowser } from "../../shared/acquisition";
import { watchSystemTheme } from "./lib/theme";
import { APP_ENTRY_FLAG, FLAG_WAIT_MS, recordAppEntry, redirectBrandNewEntrant } from "./lib/appEntryRedirect";
import { waitForFeatureFlag } from "./composables/useFeatureFlag";

// Read before first-touch capture, which would make everyone look returning
const appEntry = recordAppEntry(safeLocalStorage(), window.location, document.referrer);
captureFirstTouchInBrowser();
watchSystemTheme();

const vueApp = createApp(App);
const pinia = createPinia();

// Use VueFire with Firebase app
vueApp.use(VueFire, {
  firebaseApp,
  modules: [
    // Enable Firebase Authentication
    VueFireAuth(),
  ],
});

vueApp.use(router);
vueApp.use(pinia);
vueApp.mount("#app");

void redirectBrandNewEntrant(appEntry, {
  base: import.meta.env.VITE_BASE_URL || "/app",
  hasSession: async () => {
    await auth.authStateReady();
    return auth.currentUser !== null;
  },
  isFlagEnabled: () => waitForFeatureFlag(APP_ENTRY_FLAG, FLAG_WAIT_MS),
  currentPath: () => window.location.pathname,
  redirect: (url) => window.location.replace(url),
});

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
