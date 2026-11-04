import { defineConfig } from '@playwright/test';

// The J1 size from the forge spec: Morgan's Pixel 10 Pro XL as measured on the device, 2026-11-04 (UI_STYLE.md Target devices).
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 443, height: 816 },
    deviceScaleFactor: 2.4375,
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
