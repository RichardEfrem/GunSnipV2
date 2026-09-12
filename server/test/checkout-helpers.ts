import { randomUUID } from 'node:crypto';
import type request from 'supertest';
import { expect } from 'vitest';
import type { GuestSession } from './cart-helpers.js';

/**
 * Shared by the checkout specs: addresses resolved from the seeded region tree, and the bodies
 * checkout sends. Regions are looked up by name through the API rather than by id, so these read
 * as "Kebayoran Baru, Jakarta Selatan" and survive a reseed.
 */
type Http = ReturnType<typeof request>;

interface RegionRow {
  id: string;
  name: string;
  hasChildren: boolean;
}

export async function regionPath(http: Http, ...names: string[]): Promise<RegionRow[]> {
  const path: RegionRow[] = [];
  let parentId: string | undefined;

  for (const name of names) {
    const { body } = await http
      .get('/api/v1/shipping/regions')
      .query(parentId === undefined ? {} : { parentId })
      .expect(200);

    const match = (body as RegionRow[]).find((region) => region.name === name);
    expect(match, `no seeded region named ${name}`).toBeDefined();
    path.push(match as RegionRow);
    parentId = match?.id;
  }

  return path;
}

/** A district in Jakarta — Jabodetabek, the only zone with same-day. Regular is Rp 15.000. */
export async function jakartaDistrict(http: Http): Promise<string> {
  const path = await regionPath(http, 'DKI Jakarta', 'Jakarta Selatan', 'Kebayoran Baru');
  return path[2]?.id ?? '';
}

/** A city with no districts seeded, so the city itself is shippable. Maluku–Papua: Rp 75.000. */
export async function papuaCity(http: Http): Promise<string> {
  const path = await regionPath(http, 'Papua', 'Jayapura');
  return path[1]?.id ?? '';
}

export function quote(http: Http, session: GuestSession, body: { regionId?: string; shippingTier?: string } = {}) {
  return http.post('/api/v1/checkout/quote').set('Cookie', session.cookie).send(body);
}

export interface OrderBody {
  contact: { name: string; email: string; phone: string };
  address: { regionId: string; postalCode: string; street: string; notes?: string };
  shippingTier: string;
  paymentMethod: string;
  items: { variantId: string; quantity: number }[];
  expectedTotalIdr: number;
}

/**
 * The body checkout would send after showing `quoteBody`: its lines and its total, sent back
 * unchanged. Built from a real quote so each spec exercises the same round trip the page does.
 */
export function orderBodyFrom(
  quoteBody: { lines: { variantId: string; quantity: number }[]; totals: { totalIdr: number } },
  regionId: string,
  overrides: Partial<OrderBody> = {},
): OrderBody {
  return {
    contact: { name: 'Amuro Ray', email: 'Amuro@Example.com ', phone: '0812-3456-7890' },
    address: { regionId, postalCode: '12110', street: 'Jl. Senopati No. 79', notes: 'Leave with security' },
    shippingTier: 'REGULAR',
    paymentMethod: 'VIRTUAL_ACCOUNT',
    items: quoteBody.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
    expectedTotalIdr: quoteBody.totals.totalIdr,
    ...overrides,
  };
}

export function placeOrder(http: Http, session: GuestSession, body: OrderBody, key: string = randomUUID()) {
  return http.post('/api/v1/orders').set('Cookie', session.cookie).set('Idempotency-Key', key).send(body);
}
