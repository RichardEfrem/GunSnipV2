import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { HealthService, type HealthReport } from '../health/health.service.js';

/**
 * Admin CRUD arrives in a later phase. What exists now is the guard — every route in this
 * group carries it from day one (PRD §11.2), so no admin endpoint is ever written without one.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  async check(@CurrentActor() actor: Actor): Promise<HealthReport & { actor: Actor }> {
    return { ...(await this.health.check()), actor };
  }
}
