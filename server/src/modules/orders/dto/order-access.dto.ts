import { IsEmail, IsOptional, MaxLength } from 'class-validator';
import { CHECKOUT_FIELD_LIMITS } from '@gunsnip/shared';
import { NormaliseEmail } from '../../../common/transforms/text.js';

/**
 * The email that proves a guest may see or cancel an order from a session other than the one that
 * placed it (FR-ORD-02). The query string of `GET /orders/:orderNumber`, and the body of
 * `POST /orders/:orderNumber/cancel`.
 *
 * Optional: the placing session needs none. The access log redacts it from the URL.
 */
export class OrderAccessDto {
  @IsOptional()
  @NormaliseEmail()
  @IsEmail()
  @MaxLength(CHECKOUT_FIELD_LIMITS.email)
  readonly email?: string;
}
