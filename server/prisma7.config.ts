import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma CLI configuration (Prisma 7 keeps the connection URL here, not in schema.prisma).
 * Only the CLI reads this file — the running app builds its own adapter in PrismaService,
 * from the Zod-validated config, so `process.env` stays out of application code.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
