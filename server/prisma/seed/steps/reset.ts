import { prisma } from '../client.ts';

/**
 * Empties every table so the seed can be run repeatedly, not only against a fresh
 * `migrate reset`. TRUNCATE ... CASCADE rather than a delete cascade in dependency order:
 * one statement, no ordering to keep correct as the schema grows, and it resets sequences.
 *
 * `_prisma_migrations` is excluded — wiping it would make Prisma think the database is
 * unmigrated and try to apply everything again.
 */
export async function resetTables(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
