import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["test/custom/**/*.test.ts"], exclude: ["test/custom/**/*.fixture.test.ts"], setupFiles: ["test/custom/setup.ts"], restoreMocks: true } });
