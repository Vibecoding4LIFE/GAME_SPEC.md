// QA Phase 1 (qa-pruefer): eigene Playwright-Konfiguration, damit die langen Spiel-Durchläufe nicht Teil von
// `npm run test:e2e` werden. Aufruf: npx playwright test -c tests/qa/playwright.qa.config.ts
// Eigener Port (4174), damit ein parallel laufender `npm run test:e2e` (4173) nicht stört.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.qa\.ts$/,
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4174', trace: 'off' },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'android-quer', use: { ...devices['Pixel 7 landscape'] } },
  ],
});
