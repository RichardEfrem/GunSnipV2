import { z } from 'zod';

/**
 * Every environment variable the API reads, with its type and default. Parsed once at boot —
 * a missing or malformed value stops the process rather than surfacing as a null at 3am.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  CLIENT_ORIGIN: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /** Guest session cookie (PRD §11.1). */
  SESSION_COOKIE_NAME: z.string().min(1).default('gs_session'),
  SESSION_COOKIE_MAX_AGE_DAYS: z.coerce.number().int().positive().default(365),

  /**
   * Phase 0 admin secret (PRD §11.2). Long enough that the guard is not theatre; Phase 1
   * replaces the guard body with a role check and this goes away.
   */
  ADMIN_KEY: z.string().min(16, 'ADMIN_KEY must be at least 16 characters'),

  /** Provider is chosen here, never by branching in business logic (PRD §11.3). */
  PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
  PAYMENT_EXPIRY_HOURS: z.coerce.number().int().positive().default(24),

  MAILER_TRANSPORT: z.enum(['console']).default('console'),

  /** Gates POST /dev/payments/:id/simulate and friends (FR-PAY-05). */
  ENABLE_DEV_ENDPOINTS: z.stringbool().default(false),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses the raw environment, reporting every problem at once rather than the first.
 * Wired into ConfigModule.forRoot so an invalid environment fails the boot.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
