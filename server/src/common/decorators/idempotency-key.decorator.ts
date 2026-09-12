import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { IDEMPOTENCY_KEY_HEADER } from '@gunsnip/shared';
import type { Request } from 'express';
import { IdempotencyKeyRequiredError } from '../errors/idempotency-key-required.error.js';

/** A UUID fits, and so does any other opaque token a client might mint. */
const KEY_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Injects the validated `Idempotency-Key` header (FR-CO-07):
 *
 *     create(@Body() dto: PlaceOrderDto, @IdempotencyKey() key: string) { ... }
 *
 * Validation at the boundary, like a DTO (CLAUDE.md non-negotiable #4) — a handler that receives
 * a key can rely on it being present and well-formed.
 */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const key = context.switchToHttp().getRequest<Request>().header(IDEMPOTENCY_KEY_HEADER);

  if (key === undefined || !KEY_SHAPE.test(key)) {
    throw new IdempotencyKeyRequiredError();
  }

  return key;
});
