import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB — too small for a real phone-camera photo. 10mb
      // leaves headroom above the 8MB cap enforced in file-storage.ts for
      // multipart boundary + other form-field overhead.
      bodySizeLimit: "10mb",
    },
  },
  // Defense-in-depth for the paths proxy.ts's matcher deliberately excludes
  // (/api/**, static assets) — those never get the nonce-based CSP set in
  // proxy.ts, but still benefit from the non-CSP hardening headers below.
  // Pages routed through proxy.ts get these same header names re-set there
  // with the request-specific CSP; the later (middleware) write wins for
  // those, so there's no conflict.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // geolocation=(self): the driver page reports live position
            // (see src/app/(driver)/driver/location-reporter.tsx) via the
            // browser's own Geolocation API — same-origin only, camera/mic
            // stay fully disabled since nothing here uses them.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
