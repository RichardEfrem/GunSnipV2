'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE_SECONDS } from '@/lib/constants';
import type { ActionResult } from './action-result';

/**
 * Signing in and out of the back office (PRD §11.2).
 *
 * Phase 0's credential is a shared secret, and this is how it gets from the operator to the
 * API without ever passing through client JavaScript: the form posts it to this action, the
 * action asks the API whether it is right, and only then does it go into an httpOnly cookie
 * that only server code can read.
 *
 * **The API is the authority.** This does not compare the key against anything — it cannot, and
 * should not have a copy to compare against. `GET /admin/health` is guarded like every other
 * admin route, so a 200 means the key is good and a 401 means it is not.
 *
 * Phase 1 replaces the body of this action with a real sign-in and puts a session token in the
 * same cookie. The gate in `proxy.ts`, `lib/admin-api.ts` and every screen stay as written.
 */

/** Only what the check needs; `/admin/health` returns more and the rest is not this action's. */
const healthSchema = z.object({ status: z.string() }).loose();

export async function signInAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const key = form.get('adminKey');
  const next = form.get('next');

  if (typeof key !== 'string' || key.trim().length === 0) {
    return { status: 'error', message: 'Enter your admin key.' };
  }

  try {
    await apiFetch('/admin/health', {
      schema: healthSchema,
      cache: 'no-store',
      headers: { 'x-admin-key': key.trim() },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'error', message: 'That key was not accepted.' };
    }

    // A network failure or a 500 is not a wrong key, and telling the operator it was would send
    // them looking for the wrong problem.
    return {
      status: 'error',
      message: error instanceof ApiError ? error.message : "Couldn't reach the API to check that key.",
    };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, key.trim(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  // Only a path on this site, so a crafted `?next=` cannot turn sign-in into an open redirect.
  redirect(safeNext(next));
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);

  redirect('/admin/sign-in');
}

function safeNext(next: FormDataEntryValue | null): string {
  if (typeof next !== 'string') return '/admin';

  // A single leading slash and nothing that could start an origin — `//evil.com` and
  // `/\evil.com` are both treated by browsers as protocol-relative URLs.
  const isSitePath = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');

  return isSitePath && next.startsWith('/admin') ? next : '/admin';
}
