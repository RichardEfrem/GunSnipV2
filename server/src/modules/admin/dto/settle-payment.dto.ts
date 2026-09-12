import { IsIn } from 'class-validator';

/** `POST /admin/orders/:orderNumber/payment` (FR-PAY-04). */
const OPERATOR_STATUSES = ['PAID', 'FAILED'] as const;

export class SettlePaymentDto {
  /**
   * Only the two an operator decides. Expiry belongs to the scheduled sweep, and a refund to the
   * provider — neither is something to type into a form.
   */
  @IsIn([...OPERATOR_STATUSES], { message: `status must be one of: ${OPERATOR_STATUSES.join(', ')}` })
  status!: (typeof OPERATOR_STATUSES)[number];
}
