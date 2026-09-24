import { createApp } from "vue";
import { VueFire, VueFireAuth } from "vuefire";
import { createPinia } from "pinia";
import "./index.css";
import App from "./App.vue";
import router from "./router";
import firebaseApp from "./firebase/config";
import { captureFirstTouchInBrowser } from "../../shared/acquisition";
import { watchSystemTheme } from "./lib/theme";

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
