import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/** Where each account type lands after login / gets bounced back to. */
function landingRouteFor(accountType: string | undefined): string {
  if (accountType === "DRIVER") return "/driver";
  if (accountType === "GATE_GUARD") return "/gate";
  return "/dashboard";
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const accountType = req.auth?.user?.accountType;
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";
  const isDriverRoute = pathname === "/driver" || pathname.startsWith("/driver/");
  const isGateRoute = pathname === "/gate" || pathname.startsWith("/gate/");

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(
      new URL(landingRouteFor(accountType), req.nextUrl.origin)
    );
  }

  // Each account type only ever sees its own scoped route group — every
  // other side is bounced back to its own landing route rather than
  // allowed through.
  if (isLoggedIn && accountType === "DRIVER" && !isDriverRoute) {
    return NextResponse.redirect(new URL("/driver", req.nextUrl.origin));
  }
  if (isLoggedIn && accountType === "GATE_GUARD" && !isGateRoute) {
    return NextResponse.redirect(new URL("/gate", req.nextUrl.origin));
  }
  if (isLoggedIn && accountType !== "DRIVER" && isDriverRoute) {
    return NextResponse.redirect(
      new URL(landingRouteFor(accountType), req.nextUrl.origin)
    );
  }
  if (isLoggedIn && accountType !== "GATE_GUARD" && isGateRoute) {
    return NextResponse.redirect(
      new URL(landingRouteFor(accountType), req.nextUrl.origin)
    );
  }

  return NextResponse.next();
});

export const config = {
  // Static assets (public/ files and the icon.png/apple-icon.png routes
  // Next.js generates from src/app/icon.png) must stay excluded — an
  // unauthenticated request for a plain image, e.g. the logo on the login
  // page itself or a browser's own favicon fetch, would otherwise get
  // redirect-bounced to /login by the block below. Bit by this exact gap
  // once already: favicon.ico was excluded by name but no other image
  // extension was, so /logo-icon.png 307'd to /login until this was added.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
