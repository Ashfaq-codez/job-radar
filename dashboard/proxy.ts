import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Fast first filter: no session cookie → straight to sign-in. It only checks the cookie exists;
// pages and server actions do the real check against the database (lib/session.ts).
export default function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except sign-in, the auth API, Next internals and static files
  matcher: ["/((?!sign-in|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp)$).*)"],
};
