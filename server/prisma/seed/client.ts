import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.ts';

/**
 * The seed's own client.
 *
 * It cannot borrow `PrismaService`: that is a Nest provider whose connection string arrives
 * through the injected `AppConfig`, and booting the whole application container to insert rows
 * would be a strange thing to do. `prisma7.config.ts` loads `.env` before this runs, so
 * DATABASE_URL is present — this is the one place outside `config/` allowed to read it, because
 * it is a CLI script rather than application code.
 */
const connectionString = process.env.DATABASE_URL;

if (connectionString === undefined || connectionString === '') {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env before seeding.');
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 5 }),
});
