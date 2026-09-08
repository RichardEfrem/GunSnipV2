/**
 * Roles an authenticated actor can hold. Unused in Phase 0 — the AdminGuard compares a
 * header — but the type exists so the Actor union does not change shape in Phase 1 (PRD §11.2).
 */
export const ROLES = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;

export type Role = (typeof ROLES)[number];
