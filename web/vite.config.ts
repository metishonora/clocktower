import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/clocktower/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Clocktower Storyteller",
        short_name: "Clocktower",
        description: "개인용 Blood on the Clocktower Storyteller 도구",
        id: "/clocktower/",
        lang: "ko",
        start_url: "/clocktower/",
        scope: "/clocktower/",
        display: "standalone",
        background_color: "#f4f0e8",
        theme_color: "#173f36",
        icons: [
          {
            src: "/clocktower/assets/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/clocktower/assets/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/clocktower/assets/icons/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,webmanifest,wasm,png,svg,webp}"],
        navigateFallback: null,
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        landing: `${webRoot}index.html`,
        troubleBrewing: `${webRoot}trouble-brewing/index.html`,
        sectsAndViolets: `${webRoot}sects-and-violets/index.html`,
      },
    },
  },
});
