// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://openapply.app",
  integrations: [vue(), sitemap()],
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
