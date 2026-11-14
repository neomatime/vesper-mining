/**
 * Next.js configuration. transpilePackages lets the app import the shared contracts package straight from its TypeScript
 * source. allowedDevOrigins lets the browser tests use 127.0.0.1 in development.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@vesper/api-contracts"],
};

export default nextConfig;
