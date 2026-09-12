import { isUserActor, type Actor } from '@gunsnip/shared';
import type { ShippingDestination } from '../shipping/entities/shipping-destination.entity.js';
import type { ShippingOption } from '../shipping/entities/shipping-option.entity.js';
import { auditActor } from './audit-actor.js';
import type { OrderDraft, PaymentDraft } from './entities/order-draft.entity.js';
import type { PlaceOrderRequest } from './entities/place-order-request.entity.js';
import type { OrderLine } from './order-lines.js';
import type { OrderPricing } from './order-pricing.js';

/**
 * Assembles the rows an order is written as, from decisions already made: the lines that passed
 * `orderableLines`, the pricing `priceOrder` produced, the destination the shipping service
 * resolved. Pure, and deciding nothing — it only puts each value in the column it belongs in.
 *
 * The snapshot (FR-ORD-05) is taken here: names, SKU, image and price are copied off the variant
 * as it is at this instant, so nothing later done to the catalogue can reach this order.
 */
export interface DraftInput {
  actor: Actor;
  request: PlaceOrderRequest;
  destination: ShippingDestination;
  option: ShippingOption;
  lines: readonly OrderLine[];
  pricing: OrderPricing;
  /** The voucher the pricing applied, or null when it applied none. */
  voucherId: string | null;
  orderNumber: string;
  placedAt: Date;
  payment: Omit<PaymentDraft, 'method' | 'amountIdr'>;
}

export function draftOrder(input: DraftInput): OrderDraft {
  const { actor, request, destination, option, pricing } = input;

  return {
    orderNumber: input.orderNumber,
    sessionId: actor.sessionId,
    userId: isUserActor(actor) ? actor.userId : null,
    placedAt: input.placedAt,

    customerSnapshot: {
      name: request.contact.name,
      email: request.contact.email,
      phone: request.contact.phone,
      address: {
        regionId: destination.regionId,
        province: destination.province,
        city: destination.city,
        district: destination.district,
        postalCode: request.address.postalCode,
        street: request.address.street,
      },
    },
    customerNote: request.address.notes ?? null,
    shippingRegionId: destination.regionId,
    shippingTier: option.tier,
    shippingMinDays: option.minDays,
    shippingMaxDays: option.maxDays,

    subtotalIdr: pricing.subtotalIdr,
    discountIdr: pricing.discountIdr,
    shippingIdr: pricing.shippingIdr,
    totalIdr: pricing.totalIdr,

    items: input.lines.map(({ basketLine, quantity, lineTotalIdr }) => ({
      variantId: basketLine.variantId,
      // The bundle the line was bought as part of, plus its name written down beside it
      // (FR-CAT-11, FR-ORD-05). The id may go away when a bundle is retired; the name is what
      // keeps the components grouped on the order screen afterwards.
      bundleId: basketLine.bundle?.id ?? null,
      bundleNameSnapshot: basketLine.bundle?.name ?? null,
      productNameSnapshot: basketLine.productName,
      variantNameSnapshot: basketLine.variantName,
      skuSnapshot: basketLine.sku,
      imageUrlSnapshot: basketLine.image?.url ?? null,
      productSlugSnapshot: basketLine.productSlug,
      unitPriceIdr: basketLine.unitPriceIdr,
      quantity,
      lineTotalIdr,
    })),
    placedBy: auditActor(actor),
    payment: { ...input.payment, method: request.paymentMethod, amountIdr: pricing.totalIdr },
    redemption:
      input.voucherId === null || pricing.discountIdr === 0
        ? null
        : { voucherId: input.voucherId, amountIdr: pricing.discountIdr },
  };
}
