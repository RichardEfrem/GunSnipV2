import { randomUUID } from 'node:crypto';
import type request from 'supertest';
import { expect } from 'vitest';

/**
 * Shared by the cart specs: fresh guest sessions, and the seeded variants they add.
 *
 * Every test invents its own `gs_session` cookie, so carts are isolated from each other without
 * depending on test order. The database itself is rebuilt before each run (`global-setup.ts`),
 * so a spec that edits a price or a stock level only has to restore it for the specs after it.
 */
type Http = ReturnType<typeof request>;

export interface GuestSession {
  sessionId: string;
  /** The `Cookie` header to send. */
  cookie: string;
}

export function newSession(): GuestSession {
  const sessionId = randomUUID();
  return { sessionId, cookie: `gs_session=${sessionId}` };
}

/**
 * Two tools a Master Grade kit requires, read from the requirements endpoint rather than
 * hard-coded ids: a nipper (Rp 385.000) and a panel liner (Rp 95.000) (DoD §13.3).
 */
export async function buildTools(http: Http): Promise<{ nipper: string; liner: string }> {
  const { body } = await http.get('/api/v1/products/mg-1-100-nu-gundam-verka/requirements').expect(200);

  const find = (needle: RegExp): string => {
    const match = body.find((requirement: { tool: { name: string } }) => needle.test(requirement.tool.name));
    expect(match, `no seeded tool matching ${needle}`).toBeDefined();
    return match.variantId;
  };

  return { nipper: find(/cutter/i), liner: find(/panel line/i) };
}

/** A Master Grade kit's first variant — MG 1/100 Gundam Exia, Rp 785.000. */
export async function masterGradeKit(http: Http): Promise<string> {
  const { body } = await http.get('/api/v1/products/mg-1-100-gundam-exia').expect(200);
  return body.variants[0].id;
}

export async function addToCart(
  http: Http,
  session: GuestSession,
  items: readonly { variantId: string; quantity: number }[],
) {
  return http.post('/api/v1/cart/items').set('Cookie', session.cookie).send({ items }).expect(201);
}
