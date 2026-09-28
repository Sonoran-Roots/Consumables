import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Interim gate for the whole app while Entra ID isn't wired up yet — see
// src/lib/auth.ts. This only checks for a session cookie (cheap, edge-safe,
// no DB round trip); actual session validity is still checked by anything
// that reads the real session server-side.
//
// Named `proxy` (not `middleware`) per Next.js 16 — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|sign-in|sign-up|_next/static|_next/image|favicon.ico).*)"],
};
