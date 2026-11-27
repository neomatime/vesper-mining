/**
 * Next.js configuration for VESPER Mobile. The shared foundation (packages/core) is imported from source through the @core alias,
 * so the repository root is the build root. allowedDevOrigins lets the browser tests use 127.0.0.1 in development.
 */
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@vesper/api-contracts"],
  turbopack: { root: path.join(import.meta.dirname, "..", "..") },
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),
};

export default nextConfig;
