import { createParamDecorator, type ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import type { Request } from 'express';

/**
 * Injects the resolved `Actor` into a controller handler (PRD §11.1):
 *
 *     create(@Body() dto: CreateOrderDto, @CurrentActor() actor: Actor) { ... }
 *
 * Never inject a user id. Services take an actor, and only the actor knows whether it has one.
 */
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => {
  const { actor } = context.switchToHttp().getRequest<Request>();

  if (!actor) {
    throw new InternalServerErrorException('ActorGuard did not run for this route.');
  }

  return actor;
});
