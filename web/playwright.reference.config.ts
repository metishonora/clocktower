import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', testMatch: 'scenarioReference.spec.ts',
  timeout: 120_000, expect: { timeout: 30_000 }, fullyParallel: false,
  outputDir: '.codex-tmp/reference-browser',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL, viewport: { width: 390, height: 844 } },
  projects: [
    { name: 'webkit-light', use: { browserName: 'webkit', colorScheme: 'light' } },
    { name: 'webkit-dark', use: { browserName: 'webkit', colorScheme: 'dark' } },
    { name: 'chromium-auto-dark', use: { browserName: 'chromium', colorScheme: 'dark', launchOptions: { args: ['--enable-features=WebContentsForceDark'] } } },
  ],
});
