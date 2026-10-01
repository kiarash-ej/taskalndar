import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/core ships TypeScript source (its package.json "main" is src/index.ts).
  transpilePackages: ["@taskalndar/core"],
};

export default nextConfig;
