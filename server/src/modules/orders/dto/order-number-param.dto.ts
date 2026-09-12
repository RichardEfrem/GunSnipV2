import { Matches } from 'class-validator';
import { ORDER_NUMBER_PATTERN } from '@gunsnip/shared';
import { NormaliseOrderNumber } from '../../../common/transforms/text.js';

/** `:orderNumber` in `/orders/:orderNumber` — checked before it reaches a query (FR-ORD-01). */
export class OrderNumberParamDto {
  @NormaliseOrderNumber()
  @Matches(ORDER_NUMBER_PATTERN, { message: 'orderNumber must look like GS-260907-4471' })
  readonly orderNumber!: string;
}
