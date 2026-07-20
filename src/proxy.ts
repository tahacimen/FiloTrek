import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/** Where each account type lands after login / gets bounced back to. */
function landingRouteFor(accountType: string | undefined): string {
  if (accountType === "DRIVER") return "/driver";
  if (accountType === "GATE_GUARD") return "/gate";
  return "/dashboard";
}

const NONCE_COOKIE = "csp-nonce";
// Base64url only — this value is spliced directly into the CSP header
// string, so anything read back from an incoming cookie is validated
// against this shape before reuse (defense against header-injection via a
// hand-crafted cookie value).
const NONCE_SHAPE = /^[A-Za-z0-9_-]{20,}$/;

/**
 * A stable-per-session nonce for the strict CSP below, persisted in an
 * httpOnly cookie rather than regenerated on every request. Next.js App
 * Router client-side (soft) navigations fetch additional chunks/RSC
 * payloads without a full document reload — if middleware minted a *new*
 * random nonce on each of those requests, the newly-fetched script tags
 * would carry a nonce that no longer matches the CSP header the browser
 * already committed to for the current document, and the browser blocks
 * them outright. Reusing one nonce for the session's lifetime (rotated
 * daily via cookie maxAge) keeps every response's header and every
 * script's nonce attribute in agreement, in production, regardless of
 * caching or navigation timing. Confirmed against a real production build
 * (`next start`) after this broke it: 24 CSP violations with a per-request
 * nonce, 0 with this cookie-backed one.
 */
function getOrCreateNonce(req: Request): { nonce: string; isNew: boolean } {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${NONCE_COOKIE}=([^;]+)`));
  const existing = match?.[1];
  if (existing && NONCE_SHAPE.test(existing)) {
    return { nonce: existing, isNew: false };
  }
  const fresh = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString(
    "base64url"
  );
  return { nonce: fresh, isNew: true };
}

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Recharts/Radix set inline `style` attributes directly on DOM nodes,
    // which nonces don't cover — 'unsafe-inline' is the accepted trade-off
    // here (style-src, not script-src).
    `style-src 'self' 'unsafe-inline'`,
    // OpenStreetMap raster tiles (Leaflet loads them as <img>) for the live
    // shipment maps — /track, shipment detail, and the dashboard tracking
    // board. Without this the map renders blank under the strict CSP.
    `img-src 'self' blob: data: https://*.tile.openstreetmap.org`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

function withSecurityHeaders(
  res: NextResponse,
  csp: string,
  nonce: string,
  isNewNonce: boolean
): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );
  // Only re-set the cookie when it didn't already come in valid on the
  // request — an unconditional set-cookie on every response would reset
  // the maxAge sliding window on every single navigation, which defeats
  // the point of a daily rotation.
  if (isNewNonce) {
    res.cookies.set(NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }
  return res;
}

export default auth((req) => {
  const { nonce, isNew } = getOrCreateNonce(req);
  const csp = buildCsp(nonce);

  const isLoggedIn = !!req.auth;
  const accountType = req.auth?.user?.accountType;
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";
  // Public pages reachable by anyone, logged in or not, and never
  // redirect-bounced: the marketing landing at "/", the shipment tracking
  // page at "/track" (status-only lookup by tracking number, no login
  // required), "/davet/[token]" (invitation acceptance — the invitee has no
  // account yet by definition, see invitation-service.ts), and "/kaydol"
  // (the public sign-up application — the applicant has no account yet
  // either, see signup-service.ts). Everything else stays auth-gated below.
  const isLandingPage = pathname === "/";
  const isTrackPage = pathname === "/track" || pathname.startsWith("/track/");
  const isInvitePage = pathname === "/davet" || pathname.startsWith("/davet/");
  const isSignupPage = pathname === "/kaydol" || pathname.startsWith("/kaydol/");
  const isDriverRoute = pathname === "/driver" || pathname.startsWith("/driver/");
  const isGateRoute = pathname === "/gate" || pathname.startsWith("/gate/");

  if (isLandingPage || isTrackPage || isInvitePage || isSignupPage) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      csp,
      nonce,
      isNew
    );
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withSecurityHeaders(
      NextResponse.redirect(loginUrl),
      csp,
      nonce,
      isNew
    );
  }

  if (isLoggedIn && isLoginPage) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(landingRouteFor(accountType), req.nextUrl.origin)
      ),
      csp,
      nonce,
      isNew
    );
  }

  // Each account type only ever sees its own scoped route group — every
  // other side is bounced back to its own landing route rather than
  // allowed through.
  if (isLoggedIn && accountType === "DRIVER" && !isDriverRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/driver", req.nextUrl.origin)),
      csp,
      nonce,
      isNew
    );
  }
  if (isLoggedIn && accountType === "GATE_GUARD" && !isGateRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/gate", req.nextUrl.origin)),
      csp,
      nonce,
      isNew
    );
  }
  if (isLoggedIn && accountType !== "DRIVER" && isDriverRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(landingRouteFor(accountType), req.nextUrl.origin)
      ),
      csp,
      nonce,
      isNew
    );
  }
  if (isLoggedIn && accountType !== "GATE_GUARD" && isGateRoute) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(landingRouteFor(accountType), req.nextUrl.origin)
      ),
      csp,
      nonce,
      isNew
    );
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp,
    nonce,
    isNew
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
