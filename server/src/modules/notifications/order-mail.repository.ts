import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * The one read a transactional mail needs (CLAUDE.md: repositories are the only Prisma access).
 *
 * Its own repository rather than a call into `OrderRepository`, and not for tidiness: orders
 * would then have to import notifications to send the mail *and* notifications import orders to
 * read it, which is the module cycle CLAUDE.md tells you to break with a third piece. This is
 * that third piece, and it is narrow — a mail wants a name, an address and a list of what was
 * bought, not the order aggregate with its session ids and internal notes.
 */
const MAIL_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  customerSnapshot: true,
  subtotalIdr: true,
  discountIdr: true,
  shippingIdr: true,
  totalIdr: true,
  items: {
    select: {
      productNameSnapshot: true,
      variantNameSnapshot: true,
      quantity: true,
      lineTotalIdr: true,
    },
    orderBy: [{ productNameSnapshot: 'asc' }, { id: 'asc' }],
  },
  payment: { select: { method: true, amountIdr: true, expiresAt: true, instructions: true } },
  shipment: { select: { courier: true, trackingNumber: true, estimatedDays: true } },
} satisfies Prisma.OrderSelect;

export type OrderMailRow = Prisma.OrderGetPayload<{ select: typeof MAIL_SELECT }>;

@Injectable()
export class OrderMailRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForMail(orderId: string): Promise<OrderMailRow | null> {
    return this.prisma.order.findUnique({ where: { id: orderId }, select: MAIL_SELECT });
  }
}
