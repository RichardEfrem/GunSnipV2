import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import { AppConfig } from '../../config/app-config.js';
import { OrderMailService } from '../notifications/order-mail.service.js';
import { chargeCreatedEvent } from '../payments/payment-event.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/provider/payment-provider.js';
import { reserveStock, type StockLevel } from '../inventory/stock-reservation.js';
import type { ShippingDestination } from '../shipping/entities/shipping-destination.entity.js';
import type { ShippingOption } from '../shipping/entities/shipping-option.entity.js';
import { ShippingService } from '../shipping/shipping.service.js';
import type { OrderView } from './entities/order.entity.js';
import type { PlaceOrderRequest } from './entities/place-order-request.entity.js';
import { CartChangedError } from './errors/cart-changed.error.js';
import { IdempotencyKeyReusedError } from './errors/idempotency-key-reused.error.js';
import { TotalChangedError } from './errors/total-changed.error.js';
import { draftOrder } from './order-draft.js';
import { orderableLines } from './order-lines.js';
import { toOrderView } from './order-mapper.js';
import { randomOrderNumber } from './order-number.js';
import { priceOrder } from './order-pricing.js';
import { OrderRepository, type OrderRecord } from './order.repository.js';
import { requestHash } from './request-hash.js';

/** Which endpoint an `Idempotency-Key` belongs to, so one key cannot collide across operations. */
const IDEMPOTENCY_SCOPE = 'orders.create';

/** Long enough to cover any retry a browser or a flaky network makes of the same checkout. */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Placing an order (FR-CO-01 … FR-CO-08, PRD §8.3) — the one transaction in the store where money
 * and inventory change together.
 *
 * `place` reads as the algorithm, in order:
 *
 *   1. Claim the `Idempotency-Key`. A key already claimed means this is a repeat: answer it with
 *      the order the first request created (FR-CO-07, DoD §13.5).
 *   2. Lock the variant rows `FOR UPDATE`, in id order, and read the basket under the locks.
 *   3. Check each confirmed line is still in the cart, then reserve its stock — refusing, by
 *      name, a line that ran short since the summary was drawn (FR-CO-08).
 *   4. Price the order from the locked rows, and stop if it is not what the customer was shown.
 *   5. Open the charge with the configured `PaymentProvider`, then write the order, its snapshot
 *      lines, first event, payment and voucher redemption; write the reserved stock back; take
 *      the ordered lines out of the cart.
 *
 * All five commit together or not at all (CLAUDE.md non-negotiable #7). Every rule is a pure
 * function called between repository steps, and every database call is on `OrderUnit`.
 */
@Injectable()
export class OrderPlacementService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly shipping: ShippingService,
    private readonly config: AppConfig,
    private readonly mail: OrderMailService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async place(actor: Actor, request: PlaceOrderRequest, idempotencyKey: string): Promise<OrderView> {
    const hash = requestHash(request);
    // Outside the transaction: reference data, and a rate that moved in between is caught by the
    // total check below — the customer was shown the old one.
    const { destination, option } = await this.delivery(request);
    const placedAt = new Date();

    const placed = await this.orders.transaction(async (unit) => {
      const isClaimed = await unit.claimIdempotencyKey({
        scope: IDEMPOTENCY_SCOPE,
        key: idempotencyKey,
        sessionId: actor.sessionId,
        requestHash: hash,
        expiresAt: new Date(placedAt.getTime() + IDEMPOTENCY_TTL_MS),
      });
      if (!isClaimed) return null;

      // Which variants the confirmed lines sit on is read first, because the request names cart
      // lines and the locks have to be taken by variant id, in id order (PRD §8.3).
      const variantIds = await unit.variantIdsForLines(actor, request.items.map((item) => item.cartLineId));
      const stock = await unit.lockVariants(variantIds);
      const basket = await unit.readBasket(actor);
      if (basket === null) throw new CartChangedError({ cartLineId: request.items[0]?.cartLineId ?? '' });

      const lines = orderableLines(basket, request.items);
      const reserved = lines.map((line) => reserveStock(lockedLevel(stock, line.basketLine.variantId), line.quantity));

      const pricing = priceOrder(lines, option.priceIdr, basket.voucher, placedAt);
      if (pricing.totalIdr !== request.expectedTotalIdr) {
        throw new TotalChangedError(request.expectedTotalIdr, pricing.totalIdr);
      }

      const voucherId = pricing.voucher?.isValid === true ? (basket.voucher?.terms.id ?? null) : null;
      const orderNumber = await unit.freeOrderNumber(() => randomOrderNumber(placedAt));
      const expiresAt = new Date(placedAt.getTime() + this.config.paymentExpiryHours * HOUR_MS);

      // Opening the charge is the provider's business, and for the mock it is local arithmetic
      // over the order number — no network call, which is the only reason it belongs inside the
      // transaction. A gateway implementation would have to be charged after the commit.
      const charge = await this.payments.createCharge({
        orderNumber,
        amountIdr: pricing.totalIdr,
        method: request.paymentMethod,
        expiresAt,
        customerName: request.contact.name,
      });

      const draft = draftOrder({
        actor,
        request,
        destination,
        option,
        lines,
        pricing,
        voucherId,
        orderNumber,
        placedAt,
        payment: { provider: this.payments.name, expiresAt, ...charge },
      });

      const { orderId, paymentId } = await unit.createOrder(draft);
      await unit.recordPaymentEvent(paymentId, chargeCreatedEvent(charge.providerRef, pricing.totalIdr, placedAt));
      await unit.writeStockLevels(reserved);
      if (draft.redemption !== null) await unit.incrementVoucherUsage(draft.redemption.voucherId);
      await unit.attachOrderToKey(IDEMPOTENCY_SCOPE, idempotencyKey, orderId);
      await unit.clearOrderedLines(
        basket.cartId,
        lines.map((line) => line.basketLine.cartLineId),
        draft.redemption !== null,
      );

      return draft.orderNumber;
    });

    const record = await this.require(placed ?? (await this.replayed(actor, idempotencyKey, hash)));

    // After the commit, and only for the request that actually placed the order. A retry
    // (FR-CO-07) is answered with the same order and must not send a second "we have your
    // order" — an idempotent endpoint that mails twice is not idempotent to the customer.
    if (placed !== null) await this.mail.notify(record.id, 'PENDING_PAYMENT');

    return toOrderView(record);
  }

  /**
   * Where the order is going and by which tier. The region has to be specific enough to ship to,
   * and the tier has to be one its zone is offered — a same-day order to Makassar is not a thing
   * the store can honour, whatever a stale form sent.
   */
  private async delivery(
    request: PlaceOrderRequest,
  ): Promise<{ destination: ShippingDestination; option: ShippingOption }> {
    const { destination, options } = await this.shipping.quoteDestination(request.address.regionId);

    if (!destination.isLeaf) {
      throw new ValidationError(
        destination.level === 'PROVINCE'
          ? 'Choose a city for the delivery address.'
          : 'Choose a district for the delivery address.',
        { regionId: destination.regionId },
      );
    }

    const option = options.find((candidate) => candidate.tier === request.shippingTier);
    if (option === undefined) {
      throw new ValidationError('That delivery option is not available for this address. Choose another.', {
        shippingTier: request.shippingTier,
      });
    }

    return { destination, option };
  }

  /**
   * The order a repeated request already created (FR-CO-07). Only the same session sending the
   * same body gets it back; anything else is a key being misused, not retried.
   */
  private async replayed(actor: Actor, idempotencyKey: string, hash: string): Promise<string> {
    const record = await this.orders.findIdempotencyKey(IDEMPOTENCY_SCOPE, idempotencyKey);

    if (record !== null && (record.sessionId !== actor.sessionId || record.requestHash !== hash)) {
      throw new IdempotencyKeyReusedError();
    }

    // A claimed key is only ever visible once its order has committed, so this is unreachable
    // unless the row was cleaned up between the claim failing and this read.
    if (record?.orderNumber == null) {
      throw new ConflictError('This order is still being placed. Check your orders in a moment.');
    }

    return record.orderNumber;
  }

  private async require(orderNumber: string): Promise<OrderRecord> {
    const record = await this.orders.findByNumber(orderNumber);
    if (record === null) throw new NotFoundError('That order could not be found.', { orderNumber });

    return record;
  }
}

/** The row locked for a line. Always present — the basket line proves the variant exists. */
function lockedLevel(stock: ReadonlyMap<string, StockLevel>, variantId: string): StockLevel {
  const level = stock.get(variantId);
  if (level === undefined) throw new CartChangedError({ variantId });

  return level;
}
