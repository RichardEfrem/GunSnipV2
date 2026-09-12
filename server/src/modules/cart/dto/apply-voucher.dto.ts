import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

/**
 * `POST /cart/voucher` (FR-CART-06).
 *
 * Trimmed and upper-cased on the way in, because people type `welcome10 ` from a banner and
 * that is the same code. Normalising here keeps the lookup an exact match on the unique index.
 */
export class ApplyVoucherDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code may only contain letters, digits, - and _' })
  readonly code!: string;
}
