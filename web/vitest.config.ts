import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.tsx"],
    exclude: ["test/**/*Prototype.test.tsx"],
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
  },
});
