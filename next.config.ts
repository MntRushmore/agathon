import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  transpilePackages: ['react-native-safe-area-context', 'react-native'],
};

export default nextConfig;
