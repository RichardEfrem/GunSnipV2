import { describe, expect, it } from 'vitest';
import { redactQuery } from './access-log.middleware.js';

describe('redactQuery', () => {
  it('replaces an email in the query string', () => {
    const logged = redactQuery('/api/v1/orders/GS-260907-4471?email=amuro%40example.com');

    expect(logged).not.toContain('amuro');
    expect(logged).toContain('/api/v1/orders/GS-260907-4471?email=');
  });

  it('leaves other parameters as they were', () => {
    expect(redactQuery('/api/v1/products?grade=MG&sort=price_asc')).toBe('/api/v1/products?grade=MG&sort=price_asc');
  });

  it('leaves a URL without a query string alone', () => {
    expect(redactQuery('/api/v1/cart')).toBe('/api/v1/cart');
  });
});
