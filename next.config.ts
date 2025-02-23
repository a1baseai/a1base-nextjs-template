import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    turbo: {
      rules: {
        // Add any specific turbo rules here if needed
      }
    },
  },
  images: {
    domains: ["a1base-public.s3.us-east-1.amazonaws.com"],

  },
  
};

export default nextConfig;
