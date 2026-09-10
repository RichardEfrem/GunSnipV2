import type { ZodType } from 'zod';
import { ApiError } from './api-error';
import { env } from './env';

/**
 * The single door to the NestJS API.
 *
 * Every call names a Zod schema and the response is parsed through it, so nothing untyped
 * crosses the wire (CLAUDE.md non-negotiable #4). A response that does not match the schema is
 * a failure here rather than an `undefined` three components deep.
 *
 * Components never call this. Feature modules do, from `features/<slice>/api.ts`.
 */
export interface ApiRequest<T> {
  schema: ZodType<T>;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Serialised as JSON. Query strings belong in `path`. */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

export async function apiFetch<T>(path: string, request: ApiRequest<T>): Promise<T> {
  const { schema, method = 'GET', body, headers, ...init } = request;

  let response: Response;

  try {
    response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
      ...init,
      method,
      // Carries the gs_session cookie cross-origin. The server sets CORS `credentials` to
      // match; without both halves the browser silently drops the cookie and every guest
      // looks like a new one.
      credentials: 'include',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw ApiError.network(cause);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return schema.parse(await readJson(response));
}

/** 204, and any empty 200, parse as `undefined` so an endpoint that returns nothing can say so
 *  with `z.undefined()` instead of pretending to return a body. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text.length === 0 ? undefined : JSON.parse(text);
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get('x-request-id') ?? undefined;

  const body: unknown = await response.json().catch(() => undefined);
  const parsed = isErrorBody(body) ? body : undefined;

  return new ApiError(
    response.status,
    parsed?.error.code ?? 'UNEXPECTED_RESPONSE',
    parsed?.error.message ?? 'Something went wrong on our end.',
    parsed?.error.details,
    parsed?.requestId ?? requestId,
  );
}

interface ErrorBody {
  error: { code: string; message: string; details?: Readonly<Record<string, unknown>> };
  requestId?: string;
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;

  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}
