// QA Phase 1 (qa-pruefer): eigene Playwright-Konfiguration für die langen Spiel-Durchläufe mit eigener Strategie.
// Nicht Teil von `npm run test:e2e`. Aufruf: npx playwright test -c tests/qa/playwright.qa.config.ts
// Gleiche Server wie playwright.config.ts: Spiel auf 4173, iframe-Harness (fremder Origin, sandboxed) auf 4174.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.qa\.ts$/,
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: [
    { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000, cwd: '../..' },
    {
      command: 'python3 -m http.server 4174 --bind 127.0.0.1 --directory tests/e2e/harness',
      url: 'http://127.0.0.1:4174/iframe-harness.html',
      cwd: '../..',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'android-quer', use: { ...devices['Pixel 7 landscape'] } },
  ],
});
