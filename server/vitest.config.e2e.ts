import { defineConfig } from 'vitest/config';

/**
 * Integration tests: boot the real application graph and talk to a real database.
 * Run serially — they share that database.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});
