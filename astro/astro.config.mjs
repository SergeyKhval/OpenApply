// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://openapply.app",
  integrations: [
    vue(),
    // /save is the browser extension's handoff page, not content
    sitemap({ filter: (page) => !page.endsWith("/save/") && !page.endsWith("/save") }),
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "firebase/functions",
      ],
    },
  },
});
