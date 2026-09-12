import { Injectable } from '@nestjs/common';
import type { Env } from './env.schema.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Typed access to configuration. Inject this instead of ConfigService so call sites get real
 * property names rather than stringly-typed lookups, and so nothing outside `config/` ever
 * touches `process.env` (CLAUDE.md).
 */
@Injectable()
export class AppConfig {
  constructor(private readonly env: Env) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get port(): number {
    return this.env.PORT;
  }

  get clientOrigin(): string {
    return this.env.CLIENT_ORIGIN;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get adminKey(): string {
    return this.env.ADMIN_KEY;
  }

  get sessionCookieName(): string {
    return this.env.SESSION_COOKIE_NAME;
  }

  get sessionCookieMaxAgeMs(): number {
    return this.env.SESSION_COOKIE_MAX_AGE_DAYS * MILLISECONDS_PER_DAY;
  }

  get paymentProvider(): Env['PAYMENT_PROVIDER'] {
    return this.env.PAYMENT_PROVIDER;
  }

  get paymentExpiryHours(): number {
    return this.env.PAYMENT_EXPIRY_HOURS;
  }

  get mailerTransport(): Env['MAILER_TRANSPORT'] {
    return this.env.MAILER_TRANSPORT;
  }

  /** Absolute or relative to the server package root, which is `process.cwd()` when Nest runs. */
  get mediaDir(): string {
    return this.env.MEDIA_DIR;
  }

  get mediaPublicPath(): string {
    return this.env.MEDIA_PUBLIC_PATH;
  }

  get areDevEndpointsEnabled(): boolean {
    return this.env.ENABLE_DEV_ENDPOINTS;
  }

  get orderRateLimit(): number {
    return this.env.ORDER_RATE_LIMIT;
  }

  get orderRateWindowMs(): number {
    return this.env.ORDER_RATE_WINDOW_SECONDS * 1000;
  }

  get trustProxyHops(): number {
    return this.env.TRUST_PROXY_HOPS;
  }
}
