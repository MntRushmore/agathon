import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  transpilePackages: ['react-native-safe-area-context', 'react-native'],
  images: {
    formats: ['image/webp', 'image/avif'],
  },
};

export default nextConfig;
