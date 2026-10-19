// End-to-end smoke test: the real app against local Firebase emulators (nothing goes online).
// Run with: npm run test:e2e

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  workers: 1, // all tests share one test account and its star balance
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 412, height: 915 }, // Pixel 8
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    env: { VITE_USE_EMULATORS: 'true' },
    reuseExistingServer: false,
    timeout: 60000,
  workers: 1, // all tests share one test account and its star balance
  },
})
