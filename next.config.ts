import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    turbo: {
      rules: {
        // Add any specific turbo rules here if needed
      }
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a1base-public.s3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
};

export default nextConfig;
