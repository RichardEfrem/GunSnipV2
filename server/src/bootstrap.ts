import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import { AppConfig } from './config/app-config.js';

/**
 * Everything that turns a bare Nest app into *this* app. Shared by `main.ts` and the e2e
 * suite so tests exercise the same prefix, parsing and validation the real server uses —
 * a test against a differently-configured app proves very little.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());

  // Uploaded images, outside the API prefix: they are files, not endpoints. Every name is a fresh
  // UUID that is never rewritten, so a year of immutable caching is exactly right. Only `.webp`
  // is ever written there, so nothing served can be interpreted as a page or a script.
  app.useStaticAssets(resolve(config.mediaDir), {
    prefix: config.mediaPublicPath,
    index: false,
    dotfiles: 'deny',
    immutable: true,
    maxAge: '365d',
    setHeaders: (response) => response.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  // Decides what Express reports as `req.ip`, which is what the order rate limiter buckets on.
  // A hop count rather than `true`: trusting the whole `X-Forwarded-For` chain would let a
  // caller prepend an address of their choosing and draw a fresh allowance on every request.
  app.set('trust proxy', config.trustProxyHops);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // `credentials` is required for the gs_session cookie to survive a cross-origin request.
  app.enableCors({ origin: config.clientOrigin, credentials: true });
}
