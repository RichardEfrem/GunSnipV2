import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

/**
 * The e2e suite's environment: `.env.test`, laid over whatever `.env` provides.
 *
 * Read here rather than by the application because the application must not know it is under
 * test. Vitest injects these into every worker's `process.env` before the app boots, and
 * `@nestjs/config` lets a variable already in the environment win over the same one in `.env` —
 * so the booted app connects to the test database without a line of test-aware code.
 */
const path = fileURLToPath(new URL('../.env.test', import.meta.url));

export const TEST_ENV: Readonly<Record<string, string>> = parse(readFileSync(path));

/**
 * The test database's URL, refusing anything that is not recognisably a test database.
 *
 * The suite truncates and reseeds this database on every run. A typo that pointed it at the
 * development database would silently wipe it, so the name is checked rather than trusted.
 */
export function testDatabaseUrl(): string {
  const url = TEST_ENV.DATABASE_URL;

  if (url === undefined) {
    throw new Error(`DATABASE_URL is missing from ${path}.`);
  }

  const database = new URL(url).pathname.replace(/^\//, '');

  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to rebuild "${database}": the e2e suite only reseeds a database whose name ends in _test.`,
    );
  }

  return url;
}
