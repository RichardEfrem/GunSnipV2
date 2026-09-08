import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const VALID = {
  DATABASE_URL: 'postgresql://gunsnip:gunsnip@localhost:5432/gunsnip',
  ADMIN_KEY: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults for everything optional', () => {
    const env = validateEnv(VALID);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.SESSION_COOKIE_NAME).toBe('gs_session');
    expect(env.PAYMENT_PROVIDER).toBe('mock');
    expect(env.ENABLE_DEV_ENDPOINTS).toBe(false);
  });

  it('coerces numeric variables out of their string form', () => {
    const env = validateEnv({ ...VALID, PORT: '4000', PAYMENT_EXPIRY_HOURS: '48' });

    expect(env.PORT).toBe(4000);
    expect(env.PAYMENT_EXPIRY_HOURS).toBe(48);
  });

  it('reads a boolean flag from its string form', () => {
    expect(validateEnv({ ...VALID, ENABLE_DEV_ENDPOINTS: 'true' }).ENABLE_DEV_ENDPOINTS).toBe(true);
    expect(validateEnv({ ...VALID, ENABLE_DEV_ENDPOINTS: 'false' }).ENABLE_DEV_ENDPOINTS).toBe(false);
  });

  it('refuses to start without a database URL', () => {
    expect(() => validateEnv({ ADMIN_KEY: VALID.ADMIN_KEY })).toThrow(/DATABASE_URL/);
  });

  it('refuses an admin key short enough to be guessed', () => {
    expect(() => validateEnv({ ...VALID, ADMIN_KEY: 'short' })).toThrow(/ADMIN_KEY/);
  });

  it('reports every problem at once rather than the first', () => {
    let message = '';
    try {
      validateEnv({ PORT: 'not-a-number' });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('ADMIN_KEY');
    expect(message).toContain('PORT');
  });
});
