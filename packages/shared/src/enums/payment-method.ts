/**
 * Method the buyer picked at checkout (FR-PAY-02). In Phase 0 all three resolve to the mock
 * provider, but the choice is stored so real routing later needs no schema change.
 */
export const PAYMENT_METHODS = ['BANK_TRANSFER', 'VIRTUAL_ACCOUNT', 'E_WALLET'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
