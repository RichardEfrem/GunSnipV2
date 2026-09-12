import { z } from 'zod';
import type { PaymentInstructions } from '../provider/payment-provider.js';

/**
 * `payment.instructions` on the way back out of JSONB.
 *
 * The column is written by whichever `PaymentProvider` opened the charge, so what comes back is
 * `unknown` and is parsed rather than cast — the same treatment the customer snapshot gets. A row
 * that does not match is corruption worth a loud 500, not a confirmation page telling a customer
 * to pay into `undefined`.
 */
export const paymentInstructionsSchema: z.ZodType<PaymentInstructions> = z.object({
  channel: z.string().min(1),
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
  amountIdr: z.int().nonnegative(),
  steps: z.array(z.string().min(1)),
});
