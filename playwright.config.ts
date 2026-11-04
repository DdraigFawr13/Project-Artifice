import { defineConfig } from '@playwright/test';

// The J1 size from the forge spec: one reported Pixel 10 Pro XL viewport (UI_STYLE.md Target devices).
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
    viewport: { width: 414, height: 921 },
    deviceScaleFactor: 3.25,
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
