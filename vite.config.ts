import { defineConfig } from 'vitest/config';

// Unit tests live next to the code in src/; Playwright specs in e2e/ run with `npm run e2e`.
export default defineConfig({
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
