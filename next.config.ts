import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Self-hosted Docker image (minimal server bundle).
  output: "standalone",
  // Node-only deps that must use native require instead of being bundled into
  // the server build. @prisma/client and @aws-sdk/* are auto-externalized.
  serverExternalPackages: ["bullmq", "ioredis", "grammy"],
};

export default nextConfig;
