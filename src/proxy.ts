import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";
import { auth } from "@/lib/auth";
import { minRoleFor, roleAtLeast } from "@/lib/access";

const KIOSK_PREFIX = "/kiosk";

// Interim gate for the whole app while Entra ID isn't wired up yet — see
// src/lib/auth.ts. Two layers: (1) is there a session at all, (2) for
// anything outside /kiosk, is this account on the purchasing team, and does
// its role clear the minimum for this specific route (src/lib/access.ts).
// Everyone else — the shared, location-signed-in kiosk tablets included —
// only ever reaches /kiosk.
//
// Named `proxy` (not `middleware`) per Next.js 16 — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return redirectToSignIn(request);
  }

  if (pathname === KIOSK_PREFIX || pathname.startsWith(`${KIOSK_PREFIX}/`)) {
    return NextResponse.next();
  }

  // Fast path: role/isPurchasingTeam come straight off the signed cookie
  // cache, no DB round trip. Only falls back to a real (DB-backed) session
  // lookup on a cache miss — right after login, or once the cache's short
  // TTL has expired.
  type AccessFields = { role?: string | null; isPurchasingTeam?: boolean | null };
  let user: AccessFields | null = null;
  const cached = await getCookieCache(request);
  if (cached?.user) {
    user = cached.user as AccessFields;
  } else {
    const session = await auth.api.getSession({ headers: request.headers });
    user = (session?.user as AccessFields | undefined) ?? null;
  }

  if (!user) {
    return redirectToSignIn(request);
  }

  if (!user.isPurchasingTeam) {
    return NextResponse.redirect(new URL(KIOSK_PREFIX, request.url));
  }

  if (!roleAtLeast(user.role, minRoleFor(pathname))) {
    const url = new URL("/", request.url);
    url.searchParams.set("denied", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function redirectToSignIn(request: NextRequest) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api/auth|sign-in|sign-up|_next/static|_next/image|favicon.ico).*)"],
};
