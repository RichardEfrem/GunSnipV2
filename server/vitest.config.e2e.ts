import { defineConfig } from 'vitest/config';
import { TEST_ENV, testDatabaseUrl } from './test/test-env.js';

/**
 * Integration tests: boot the real application graph and talk to a real database — the one
 * named in `.env.test`, never the development database in `.env`.
 *
 * Run serially — they share that database.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    // Validated here as well as in the global setup, so a misconfigured URL stops the run
    // before any worker boots the app against it.
    env: { ...TEST_ENV, DATABASE_URL: testDatabaseUrl() },
    globalSetup: ['./test/global-setup.ts'],
  },
});
