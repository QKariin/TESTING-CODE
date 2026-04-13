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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'http',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.wixstatic.com',
      },
    ],
    minimumCacheTTL: 604800, // 1 week — profile pics rarely change
  },
};

export default nextConfig;
