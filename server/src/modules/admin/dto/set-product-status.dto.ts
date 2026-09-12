import { IsIn } from 'class-validator';
import { PRODUCT_STATUSES, type ProductStatus } from '@gunsnip/shared';

/** `PUT /admin/products/:id/status` (FR-ADM-02). */
export class SetProductStatusDto {
  @IsIn(PRODUCT_STATUSES)
  readonly status!: ProductStatus;
}
