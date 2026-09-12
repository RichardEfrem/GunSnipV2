import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

/**
 * Boots the real application graph with the real global configuration.
 *
 * `configure` is the one seam: a spec that needs different settings replaces a provider rather
 * than the application asking whether it is under test. Most specs pass nothing.
 */
export async function createTestApp(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication> {
  const moduleRef = await configure(Test.createTestingModule({ imports: [AppModule] })).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  return app;
}
