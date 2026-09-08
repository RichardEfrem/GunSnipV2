import type { Actor } from '@gunsnip/shared';

/**
 * Request fields populated by our own middleware and guards. Both are optional because they
 * are only present once that middleware/guard has run; readers treat absence as a wiring bug.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      actor?: Actor;
    }
  }
}

export {};
