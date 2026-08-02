import { defineConfig } from '@playwright/test';

/**
 * E2E accessibility gate. Tests run against the production build served by
 * `vite preview`, so what passes here is what actually ships to Pages.
 * The build runs as part of the webServer command rather than being left to
 * the caller: `preview` only serves whatever is already in dist/, so a failing
 * build would otherwise leave the previous good bundle on disk and let the
 * suite pass green against source that no longer builds.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4311 --strictPort',
    url: 'http://localhost:4311/crypto-lab-stego-suite/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4311/crypto-lab-stego-suite/',
    colorScheme: 'dark',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
