import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './test-env.js';

/**
 * Rebuilds the integration-test database before the suite runs.
 *
 * `migrate deploy` then the seed, rather than `migrate reset`: the seed truncates every table
 * itself (`prisma/seed/steps/reset.ts`), so the pair is already a full rebuild, and `deploy` only
 * ever applies migrations — it cannot drop a database, which is the right power for a step that
 * runs unattended on every test run.
 *
 * Every spec therefore starts from the same seeded catalogue regardless of what the previous
 * run left behind, and a spec is free to change a variant's price or stock to exercise a path
 * without that change leaking into development data.
 */
export default function setup(): void {
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };

  for (const args of [
    ['prisma', 'migrate', 'deploy'],
    ['prisma', 'db', 'seed'],
  ]) {
    try {
      execFileSync('npx', args, { env, stdio: 'pipe' });
    } catch (cause) {
      // Surface the CLI's own output: "could not connect" and "database does not exist" are
      // both answered by the README's setup steps, and the message says which one it was.
      const output = cause instanceof Error && 'stderr' in cause ? String(cause.stderr) : '';
      throw new Error(`\`npx ${args.join(' ')}\` failed against the test database.\n${output}`);
    }
  }
}
