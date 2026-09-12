import { z } from 'zod';

/**
 * Who the order is for and where it goes, exactly as given at purchase (PRD §9, FR-ORD-05).
 *
 * Stored as JSONB rather than as foreign keys, so a region renamed by an operator or a profile
 * edited in Phase 1 can never rewrite where a past order was sent. The names are resolved from
 * the region tree once, at placement, and written down.
 *
 * A Zod schema rather than an interface because this crosses a boundary in the other direction
 * too: it comes back *out* of a JSONB column typed as `unknown`, and parsing it there is what
 * turns a malformed row into a loud error instead of an `undefined` on the confirmation page
 * (CLAUDE.md non-negotiable #4).
 */
export const customerSnapshotSchema = z.object({
  name: z.string(),
  /** Lower-cased at the boundary, so guest lookup (FR-ORD-02) is an exact comparison. */
  email: z.string(),
  phone: z.string(),
  address: z.object({
    /** The most specific region the customer chose — the one the rate was quoted for. */
    regionId: z.string(),
    province: z.string(),
    city: z.string().nullable(),
    district: z.string().nullable(),
    postalCode: z.string(),
    street: z.string(),
  }),
});

export type CustomerSnapshot = z.infer<typeof customerSnapshotSchema>;
