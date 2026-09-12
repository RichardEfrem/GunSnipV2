import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE_SECONDS } from '@/lib/constants';

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
 * It also gates the back office (PRD §11.2) — see `adminGate` below.
 *
 * Renamed from `middleware.ts` in Next 16; the export must be named `proxy`.
 */
export function proxy(request: NextRequest): NextResponse {
  const gate = adminGate(request);
  if (gate !== null) return gate;

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

const ADMIN_PREFIX = '/admin';
const SIGN_IN = '/admin/sign-in';

/**
 * Keeps `/admin/*` behind the sign-in page, and the sign-in page away from anyone already in.
 *
 * The real authority is the API's `AdminGuard`, which checks the key on every request and would
 * refuse an unauthenticated one regardless of what happens here. This is about not rendering a
 * dashboard shell that is only going to fill with 401s — and about never leaving admin routes
 * open on the client "because auth comes later", which CLAUDE.md rules out.
 *
 * The cookie's *presence* is all this can check: it is httpOnly and its value is a secret the
 * proxy has no business validating. A stale or wrong key gets past here and is refused by the
 * API, which the admin layout turns back into a redirect to sign in.
 *
 * Returns null when the request is not about admin at all, so the session-minting path below
 * runs exactly as it did before.
 */
function adminGate(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith(ADMIN_PREFIX)) return null;

  const isSignedIn = request.cookies.has(ADMIN_COOKIE);
  const isSignInPage = pathname === SIGN_IN;

  if (isSignedIn) {
    return isSignInPage ? NextResponse.redirect(new URL(ADMIN_PREFIX, request.url)) : null;
  }

  if (isSignInPage) return null;

  const signIn = new URL(SIGN_IN, request.url);
  // Carried so signing in returns the operator to the page they asked for, rather than dropping
  // them on the dashboard and making them navigate again.
  signIn.searchParams.set('next', pathname + request.nextUrl.search);

  return NextResponse.redirect(signIn);
}

export const config = {
  /* Everything a person navigates to. Static assets never need a session. */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2)$).*)',
  ],
};
