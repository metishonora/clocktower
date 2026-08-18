import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://127.0.0.1:4173/clocktower/";

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL ? undefined : {
    command: "pnpm run preview --host 0.0.0.0 --strictPort --port 4173",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  reporter: process.env.CI ? "github" : "line",
});
