import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // This is only an early redirect. The cookie may be forged; server pages/actions verify it with Better Auth.
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/admin/:path*",
    "/users/:path*",
    "/my-games/:path*",
    "/game/:path*",
  ],
};
