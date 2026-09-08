/**
 * Base for every error the business layer throws.
 *
 * Deliberately carries no HTTP status: services must not know about status codes (CLAUDE.md).
 * The five category subclasses in this folder are what the exception filter maps, so a new
 * domain error extends the category that fits and the filter never needs editing.
 */
export abstract class DomainError extends Error {
  /** Stable, machine-readable identifier the client can branch on. SCREAMING_SNAKE_CASE. */
  abstract readonly code: string;

  /** Structured context — which line, which variant, how many were left. */
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}
