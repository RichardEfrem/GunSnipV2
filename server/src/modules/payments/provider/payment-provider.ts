import type { PaymentEventType, PaymentMethod, PaymentStatus } from '@gunsnip/shared';

/**
 * The payment seam (PRD §11.3, CLAUDE.md "Deferred seams").
 *
 * `MockPaymentProvider` implements this now and a real gateway implements it later. Everything
 * downstream — the state machines, the order service, the admin screens, the emails — consumes
 * `PaymentEvent` and never learns which provider produced it. The provider is chosen by
 * `PAYMENT_PROVIDER` in the environment, never by a branch in business logic.
 *
 * The dev-only simulate endpoint (FR-PAY-05) goes through `parseCallback` with a payload shaped
 * like a webhook, so the path a simulated payment takes is the path a real one will take.
 */
export interface PaymentProvider {
  /** The provider's name as stored on the payment row, so an old row stays interpretable. */
  readonly name: string;

  /** Opens a charge for an order. Called once, when the order is created (FR-PAY-01). */
  createCharge(order: ChargeRequest): Promise<ChargeResult>;

  /**
   * Turns a provider callback into the one event shape the rest of the system understands.
   * A real gateway verifies `signature` here; rejecting a payload is this method's job, so no
   * caller ever has to decide whether a webhook is genuine.
   */
  parseCallback(payload: unknown, signature?: string): Promise<PaymentEvent>;

  /** Reverses a settled charge, in whole or in part. Drives PAID → REFUNDED (PRD §8.2). */
  refund(charge: RefundRequest, amountIdr: number): Promise<PaymentEvent>;
}

/**
 * A callback body, structurally. Spelled out here rather than borrowed from Prisma: the payload
 * lands in a JSONB column, but a provider implementation has no business importing the ORM's
 * types to describe what it received over HTTP.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

/** Injection token for the configured provider. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * What a provider needs to open a charge.
 *
 * A value object rather than the `Order` row CLAUDE.md sketches: a provider has no business
 * seeing snapshot columns or a session id, and passing the row would make every provider
 * implementation depend on the Prisma schema.
 */
export interface ChargeRequest {
  orderNumber: string;
  amountIdr: number;
  method: PaymentMethod;
  expiresAt: Date;
  customerName: string;
}

export interface ChargeResult {
  /** The provider's own id for the charge — the mock's virtual account number. */
  providerRef: string;
  instructions: PaymentInstructions;
}

/** What the confirmation page shows the customer (FR-PAY-03). */
export interface PaymentInstructions {
  /** The channel as a customer would name it: "BCA Virtual Account". */
  channel: string;
  /** The number they type into their banking or wallet app. */
  accountNumber: string;
  accountName: string;
  amountIdr: number;
  /** In order, one per line. Written for a customer, not an operator. */
  steps: readonly string[];
}

/** Identifies a charge to reverse, without handing the provider a Prisma row. */
export interface RefundRequest {
  providerRef: string;
  amountIdr: number;
}

/**
 * One thing that happened to a charge, in the shape a real gateway webhook reports it
 * (FR-PAY-07). This is what the `payment_event` log stores and what the settlement service
 * consumes; swapping the provider changes what produces these, not what they look like.
 */
export interface PaymentEvent {
  type: PaymentEventType;
  providerRef: string;
  /** The status the charge is in *after* this event. Fed to the payment state machine. */
  status: PaymentStatus;
  amountIdr: number;
  occurredAt: Date;
  /** The callback body verbatim, logged as received so it can be replayed or audited. */
  payload: JsonObject;
}

/**
 * A provider that can produce its own callback bodies, so the dev endpoint can send one back to
 * `parseCallback` and settle a payment through the real webhook path (FR-PAY-05).
 *
 * Optional on purpose. A live gateway has no business being able to forge its own notifications,
 * and when one is configured this capability is simply absent — the dev endpoint then refuses
 * rather than reaching for a second, fake code path that would prove nothing.
 */
export interface SimulatablePaymentProvider extends PaymentProvider {
  simulateCallback(charge: RefundRequest, type: PaymentEventType): JsonObject;
}

export function isSimulatable(provider: PaymentProvider): provider is SimulatablePaymentProvider {
  return typeof (provider as Partial<SimulatablePaymentProvider>).simulateCallback === 'function';
}
