import { IsEmail, IsUUID, MaxLength } from 'class-validator';

/**
 * Back-in-stock capture on an out-of-stock product page (FR-PDP-12).
 *
 * No `sessionId` field. The session comes from the `gs_session` cookie via `ActorGuard`
 * (PRD §11.1) — a body that carried one would let a caller register interest under someone
 * else's session.
 */
export class CreateNotifyRequestDto {
  @IsUUID()
  readonly variantId!: string;

  /**
   * `notify_request` is unique on `(variant_id, email)`, and the column is compared verbatim —
   * so the length bound here is what stops a row being written that the index would have to
   * carry. Normalisation happens in the service, not in validation.
   */
  @IsEmail()
  @MaxLength(254)
  readonly email!: string;
}
