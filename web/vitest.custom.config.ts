import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'custom-node', environment: 'node', include: ['test/custom/**/*.test.ts'],
        exclude: ['test/custom/**/*.fixture.test.ts'], setupFiles: ['test/custom/setup.ts'], restoreMocks: true } },
      { plugins: [react()], test: { name: 'custom-ui', environment: 'jsdom', include: ['test/custom/**/*.test.tsx'],
        setupFiles: ['test/custom/setup.ts'], restoreMocks: true } },
    ],
  },
});
