import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/site.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
  // @ts-ignore - Bypass tight NextConfig typing on older versions to allow ESLint skip
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
