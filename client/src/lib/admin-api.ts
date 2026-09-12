import { cookies } from 'next/headers';
import { apiFetch, type ApiRequest } from './api-client';
import { ApiError } from './api-error';
import { ADMIN_COOKIE } from './constants';

/**
 * `apiFetch` for the back office: the same door to the API, with the admin credential attached.
 *
 * **Server-only.** Importing this into a Client Component is a build error, because
 * `next/headers` cannot be reached from one — which is exactly the property that keeps the key
 * out of the browser bundle. Admin screens are Server Components and admin mutations are Server
 * Actions; both run where the cookie can be read, and neither ever sends the key to the client.
 *
 * Never cached. A back office showing a stale order is worse than a slow one, and `no-store` is
 * the only correct default for data an operator is about to act on.
 */
export async function adminApiFetch<T>(path: string, request: ApiRequest<T>): Promise<T> {
  const key = await adminKey();

  if (key === undefined) {
    // The same shape the API would return, so a screen has one error contract rather than two.
    throw new ApiError(401, 'UNAUTHORIZED', 'Your admin session has ended. Sign in again.');
  }

  return apiFetch(path, {
    cache: 'no-store',
    ...request,
    headers: { ...request.headers, 'x-admin-key': key },
  });
}

/** The stored credential, or undefined when nobody is signed in. */
export async function adminKey(): Promise<string | undefined> {
  // Promise-returning in Next 16.
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value;
}

export async function isAdminSignedIn(): Promise<boolean> {
  return (await adminKey()) !== undefined;
}

/**
 * A query string from the parts that are set.
 *
 * Admin screens put their filters in the URL for the same reason the storefront does
 * (FR-CAT-07): a link to "unpaid orders from last week" is a link an operator sends to a
 * colleague. This drops empty values so `?status=` never reaches the API as a filter for the
 * empty string.
 */
export function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query.length === 0 ? '' : `?${query}`;
}
