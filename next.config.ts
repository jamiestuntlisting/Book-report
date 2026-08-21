import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings (D1, R2) available via getCloudflareContext()
// during `next dev`, backed by local emulations. Guarded: with the AI binding
// present, running it during production builds tries to open a remote
// wrangler session and fails in CI.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  eslint: {
    // Lint is run explicitly in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
