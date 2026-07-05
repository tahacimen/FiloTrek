import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/** Where each account type lands after login / gets bounced back to. */
function landingRouteFor(accountType: string | undefined): string {
  if (accountType === "DRIVER") return "/driver";
  if (accountType === "GATE_GUARD") return "/gate";
  return "/dashboard";
}

/**
 * Per-request nonce for the strict CSP below — generated here (not in
 * next.config.ts) because it must be unique per response. Forwarded to the
 * page via the x-nonce request header; Next.js itself applies it to the
 * inline bootstrap scripts it renders once it sees the matching
 * `'nonce-...'` in the response's Content-Security-Policy header, per
 * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy.
 * No handwritten <script> tags in this app, so nothing else needs the nonce.
 */
function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Recharts/Radix set inline `style` attributes directly on DOM nodes,
    // which nonces don't cover — 'unsafe-inline' is the accepted trade-off
    // here (style-src, not script-src).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

function withSecurityHeaders(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  return res;
}

export default auth((req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const isLoggedIn = !!req.auth;
  const accountType = req.auth?.user?.accountType;
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";
  // Public marketing landing at "/" — reachable by anyone, logged in or not,
  // and never redirect-bounced. Everything else stays auth-gated below.
  const isLandingPage = pathname === "/";
  const isDriverRoute = pathname === "/driver" || pathname.startsWith("/driver/");
  const isGateRoute = pathname === "/gate" || pathname.startsWith("/gate/");

  if (isLandingPage) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      csp
    );
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl), csp);
  }

  if (isLoggedIn && isLoginPage) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(landingRouteFor(accountType), req.nextUrl.origin)
      ),
      csp
    );
  }

  // Each account type only ever sees its own scoped route group — every
  // other side is bounced back to its own landing route rather than
  // allowed through.
  if (isLoggedIn && accountType === "DRIVER" && !isDriverRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/driver", req.nextUrl.origin)),
      csp
    );
  }
  if (isLoggedIn && accountType === "GATE_GUARD" && !isGateRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/gate", req.nextUrl.origin)),
      csp
    );
  }
  if (isLoggedIn && accountType !== "DRIVER" && isDriverRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(landingRouteFor(accountType), req.nextUrl.origin)
      ),
      csp
    );
  }
  if (isLoggedIn && accountType !== "GATE_GUARD" && isGateRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(landingRouteFor(accountType), req.nextUrl.origin)
      ),
      csp
    );
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp
  );
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
