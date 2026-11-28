import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
  },
  webServer: [
    {
      command: 'npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // zweiter Origin für tests/e2e/iframe.spec.ts (Spiel im sandboxed iframe wie in der Artifact-Vorschau)
      command: 'python3 -m http.server 4174 --bind 127.0.0.1 --directory tests/e2e/harness',
      url: 'http://127.0.0.1:4174/iframe-harness.html',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-quer', use: { ...devices['iPhone 13 landscape'], browserName: 'chromium' } },
    { name: 'android-quer', use: { ...devices['Pixel 7 landscape'] } },
  ],
});
