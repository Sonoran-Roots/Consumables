import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";
import { auth } from "@/lib/auth";
import { decideAccess } from "@/lib/access";

const KIOSK_PREFIX = "/kiosk";

// Gate for the whole app. Layers: (1) is there a session at all, (2) which
// module is this path in, and does the user have access to that module at a
// high enough level for this specific route (src/lib/access.ts).
//   - /kiosk: any signed-in session (shared, location-signed-in tablets).
//   - /modules: the "which module?" chooser; anyone with at least one module.
//   - /inventory-audit/*: Inventory Audit module, needs User.auditRole.
//   - everything else: Consumable Management, needs isPurchasingTeam.
// Someone with neither module only ever reaches /kiosk.
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

  // Fast path: role/isPurchasingTeam/auditRole come straight off the signed
  // cookie cache, no DB round trip. Only falls back to a real (DB-backed)
  // session lookup on a cache miss — right after login, or once the cache's
  // short TTL has expired.
  type AccessFields = {
    role?: string | null;
    isPurchasingTeam?: boolean | null;
    auditRole?: string | null;
  };
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

  const decision = decideAccess(pathname, user);
  if (decision.allow) return NextResponse.next();

  const url = new URL(decision.to, request.url);
  if (decision.denied) url.searchParams.set("denied", "1");
  return NextResponse.redirect(url);
}

function redirectToSignIn(request: NextRequest) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // jars-logo.png has to load on the signed-out sign-in page too.
  matcher: [
    "/((?!api/auth|api/health|sign-in|sign-up|_next/static|_next/image|favicon.ico|jars-logo.png).*)",
  ],
};
