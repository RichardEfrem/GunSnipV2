import { defineConfig } from 'vitest/config';

/** Unit tests: fast, no database, colocated with the code they cover. */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
