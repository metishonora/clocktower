import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/clocktower/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Clocktower Storyteller",
        short_name: "Clocktower",
        description: "개인용 Trouble Brewing Storyteller 도구",
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
        navigateFallback: "/clocktower/index.html",
      },
    }),
  ],
});
