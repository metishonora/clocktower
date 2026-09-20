import {defineConfig} from '@playwright/test';
const baseURL=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:4173/clocktower/';
export default defineConfig({
 testDir:'./test/browser',testMatch:'issue232-composite.spec.ts',fullyParallel:false,
 timeout:90000,expect:{timeout:15000},outputDir:'.codex-tmp/issue232-browser',
 use:{baseURL,screenshot:'only-on-failure',trace:'retain-on-failure',serviceWorkers:'block'},
 webServer:process.env.PLAYWRIGHT_BASE_URL?undefined:{command:'pnpm run preview --host 127.0.0.1 --strictPort --port 4173',url:baseURL,reuseExistingServer:false,timeout:120000},
 projects:[{name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1366,height:1000}}},{name:'webkit-phone',use:{browserName:'webkit',viewport:{width:390,height:844}}},{name:'webkit-tablet',use:{browserName:'webkit',viewport:{width:820,height:1180}}}],
});
