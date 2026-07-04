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
};

export default nextConfig;
