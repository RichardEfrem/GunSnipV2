import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config.js';
import { validateEnv } from './env.schema.js';

/**
 * Loads .env files, validates the result, and exposes it as the typed AppConfig.
 *
 * `validate` runs first and fails the boot on a bad environment; the factory then re-reads the
 * now-known-good `process.env`. That keeps AppConfig a plain class over a plain object, so it
 * can be constructed directly in a test without a Nest container.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
      cache: true,
    }),
  ],
  providers: [
    {
      provide: AppConfig,
      useFactory: () => new AppConfig(validateEnv(process.env)),
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
