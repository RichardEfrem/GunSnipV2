import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE_SECONDS } from '@/lib/constants';

/**
 * Mints the guest session cookie (PRD §11.1).
 *
 * This has to happen here rather than in a layout: a Server Component cannot set a cookie, and
 * the very first render already needs one — a visitor who adds to cart before any round trip
 * would otherwise have nothing to hang the cart on.
 *
 * The API's `ActorGuard` mints one too, as a fallback for calls that skip the web app. Both
 * only ever mint when the cookie is absent, so whichever runs first wins and the other reads it.
 *
 * Phase 1 of the PRD adds a signed-in arm; this file does not change. It establishes *a*
 * session, not an identity — `session_id` stays on the cart and order rows after login, which
 * is what makes adopting a guest cart possible at all.
 *
 * Renamed from `middleware.ts` in Next 16; the export must be named `proxy`.
 */
export function proxy(request: NextRequest): NextResponse {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const sessionId = crypto.randomUUID();

  // Set on the request as well as the response, so the render happening *now* sees the session
  // rather than waiting for the browser to send it back on the next navigation.
  request.cookies.set(SESSION_COOKIE, sessionId);
  const response = NextResponse.next({ request });

  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}

export const config = {
  /* Everything a person navigates to. Static assets never need a session. */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2)$).*)',
  ],
};
