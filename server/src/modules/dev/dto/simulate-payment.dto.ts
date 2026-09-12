import { IsIn } from 'class-validator';
import type { PaymentEventType } from '@gunsnip/shared';

/**
 * `POST /dev/payments/:id/simulate` (FR-PAY-05).
 *
 * The outcomes worth pretending to be: paid, declined, or the window closing. `CHARGE_CREATED`
 * is not offered — the charge is opened with the order, and replaying its creation would say
 * nothing. `CHARGE_REFUNDED` belongs to the refund flow, which goes through the provider.
 */
const SIMULATABLE = ['CHARGE_PAID', 'CHARGE_FAILED', 'CHARGE_EXPIRED'] as const;

export type SimulatableEvent = (typeof SIMULATABLE)[number];

export class SimulatePaymentDto {
  @IsIn([...SIMULATABLE], { message: `event must be one of: ${SIMULATABLE.join(', ')}` })
  event!: SimulatableEvent & PaymentEventType;
}
