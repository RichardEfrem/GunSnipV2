import { z } from 'zod';

/**
 * The web app's environment, validated once at module load so a missing or malformed value
 * fails the build rather than surfacing as an undefined URL in a fetch three screens later.
 * Mirrors the server's `config/env.schema.ts` (CLAUDE.md: validate at every boundary).
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so each one has to be read as a literal
 * member access — a dynamic lookup would be replaced with `undefined` in the browser bundle.
 */
const schema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.url({ error: 'Must be the absolute base URL of the API, e.g. http://localhost:3001/api/v1' }),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

if (!parsed.success) {
  throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
