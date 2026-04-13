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
        pathname: '/storage/v1/object/public/**',
      },
    ],
    minimumCacheTTL: 604800, // 1 week — profile pics rarely change
  },
  // @ts-ignore - Bypass tight NextConfig typing on older versions to allow ESLint skip
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
