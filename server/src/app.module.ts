import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { FallbackModule } from './common/controllers/fallback.module.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';
import { ActorGuard } from './common/guards/actor.guard.js';
import { AccessLogMiddleware } from './common/middleware/access-log.middleware.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { ConfigModule } from './config/config.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  // FallbackModule must stay last — it claims every path nothing else matched.
  imports: [ConfigModule, PrismaModule, HealthModule, AdminModule, FallbackModule],
  providers: [
    // Every request gets an Actor — no endpoint can forget to ask (PRD §11.1).
    { provide: APP_GUARD, useClass: ActorGuard },
    // The single domain-error-to-HTTP mapping (CLAUDE.md).
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, AccessLogMiddleware).forRoutes('*splat');
  }
}
