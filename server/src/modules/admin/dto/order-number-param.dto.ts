import { Matches } from 'class-validator';
import { ORDER_NUMBER_PATTERN } from '@gunsnip/shared';

/** The `:orderNumber` in an admin order route. */
export class AdminOrderNumberParamDto {
  @Matches(ORDER_NUMBER_PATTERN, { message: 'orderNumber must look like GS-YYMMDD-XXXX.' })
  orderNumber!: string;
}
