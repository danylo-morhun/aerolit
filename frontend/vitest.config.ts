import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // `e2e/` is Playwright's; Vitest would try to run it and fail on its imports.
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Depth where the logic is: the domain layer is the contract the whole
      // UI reads from, so it carries a hard threshold. Views are thin by
      // construction and covered through the integration tests instead.
      include: ['src/domain/**/*.ts', 'src/api/**/*.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
