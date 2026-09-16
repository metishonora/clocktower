import { defineConfig } from '@playwright/test';
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:4173/clocktower/';
export default defineConfig({
  testDir: './test/browser', testMatch: 'scenarioReference.spec.ts',
  timeout: 120_000, expect: { timeout: 30_000 }, fullyParallel: false,
  outputDir: '.codex-tmp/reference-browser',
  use: { baseURL, viewport: { width: 390, height: 844 } },
  webServer: externalBaseURL ? undefined : {
    command: 'pnpm run preview --host 127.0.0.1 --strictPort --port 4173',
    url: baseURL, reuseExistingServer: false, timeout: 120_000,
  },
  projects: [
    { name: 'webkit-light', use: { browserName: 'webkit', colorScheme: 'light' } },
    { name: 'webkit-dark', use: { browserName: 'webkit', colorScheme: 'dark' } },
    { name: 'chromium-auto-dark', use: { browserName: 'chromium', colorScheme: 'dark', launchOptions: { args: ['--enable-features=WebContentsForceDark'] } } },
  ],
});
