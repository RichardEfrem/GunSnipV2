/**
 * The one error shape the API produces (`DomainExceptionFilter` on the server), reflected here
 * so the web app has exactly one error contract to handle.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
    /** Correlates a user-facing failure with a line in the server log. */
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The request never reached the API — offline, DNS, connection refused. */
  static network(cause: unknown): ApiError {
    return new ApiError(0, 'NETWORK_ERROR', "Couldn't reach the store.", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}
