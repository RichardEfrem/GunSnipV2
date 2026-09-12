import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { AppConfig } from './config/app-config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // JSON lines in production for log shipping; readable output while developing (PRD §12).
    logger: new ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
    bufferLogs: true,
  });

  configureApp(app);
  app.enableShutdownHooks();

  // Resolved after creation, so an invalid environment has already failed the boot.
  await app.listen(app.get(AppConfig).port);
}

await bootstrap();
