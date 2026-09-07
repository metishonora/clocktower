import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const webRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "./customActionResultValidation.js",
        replacement: resolve(webRoot, "test/issue206FixtureCustomActionResultValidation.ts"),
      },
      {
        find: /\/src\/core\/customActionResultValidation\.(?:js|ts)$/,
        replacement: resolve(webRoot, "test/issue206FixtureCustomActionResultValidation.ts"),
      },
      {
        find: "../generated/clocktower_wasm/clocktower_wasm.js",
        replacement: resolve(webRoot, ".codex-tmp/issue206-wasm/clocktower_wasm.js"),
      },
      {
        find: /\/src\/generated\/clocktower_wasm\/clocktower_wasm\.js$/,
        replacement: resolve(webRoot, ".codex-tmp/issue206-wasm/clocktower_wasm.js"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["test/issue206CustomRuntime.integration.test.tsx"],
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
  },
});
