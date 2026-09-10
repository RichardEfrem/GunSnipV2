import { cookies } from 'next/headers';
import { apiFetch, type ApiRequest } from './api-client';
import { SESSION_COOKIE } from './constants';

/**
 * `apiFetch` for Server Components, Server Actions and route handlers.
 *
 * A server-side fetch carries no cookie jar, so `credentials: 'include'` does nothing there and
 * the guest's session has to be attached by hand — without this every server render would look
 * to the API like a brand new visitor and come back with an empty cart.
 *
 * Kept apart from `api-client.ts` because `next/headers` cannot be imported into a module that
 * a Client Component also reaches.
 */
export async function serverApiFetch<T>(path: string, request: ApiRequest<T>): Promise<T> {
  // Promise-returning in Next 16.
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;

  return apiFetch(path, {
    ...request,
    headers: {
      ...request.headers,
      ...(sessionId === undefined ? {} : { cookie: `${SESSION_COOKIE}=${sessionId}` }),
    },
  });
}
