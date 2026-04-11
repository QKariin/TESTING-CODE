import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    minimumCacheTTL: 2592000, // 30 days
  },
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
