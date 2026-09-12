import { ConflictError } from './conflict.error.js';

/**
 * A state machine was asked for a move its transition map does not contain (PRD §8) — cancelling
 * an order that has already shipped, paying one that has expired. A conflict with current state,
 * so it maps to 409 through the existing filter entry.
 *
 * Shared by the order machine now and the payment machine in Phase 8, which is why it lives here
 * rather than in either module.
 */
export class IllegalTransitionError extends ConflictError {
  override readonly code: string = 'ILLEGAL_TRANSITION';

  constructor(machine: string, from: string, to: string, message?: string) {
    super(message ?? `${article(machine)} ${machine} cannot move from ${from} to ${to}.`, { machine, from, to });
  }
}

/**
 * "An order", "A payment".
 *
 * The default message is operator-facing — it is what the back office shows when a transition is
 * refused — and "A order cannot move from PAID to SHIPPED" reads as a bug in the shop rather
 * than as an answer. Vowel-initial is the whole rule the two machine names need.
 */
function article(machine: string): string {
  return /^[aeiou]/i.test(machine) ? 'An' : 'A';
}
