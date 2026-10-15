import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/core ships TypeScript source (its package.json "main" is src/index.ts).
  transpilePackages: ["@taskalndar/core"],
  // Background image uploads go through a server action (limit is 1MB by default).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
