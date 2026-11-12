import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    viewport: { width: 1440, height: 900 },
    channel: 'chrome',
  },
  projects: [
    { name: 'chromium-1440', testIgnore: 'record.spec.ts', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'record',
      testMatch: 'record.spec.ts',
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
  // Tests run against the production build: `npm run e2e` builds first, this serves it with the demo server.
  webServer: {
    command: `node ../scripts/serve.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
