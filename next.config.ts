import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  eslint: {
    // Lint is run explicitly in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
