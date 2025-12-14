import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  experimental: {
    // monorepo 内の packages/ からの import を許可
    externalDir: true
  },
  transpilePackages: ["@bookmarket/shared-kernel"],
  images: {
    unoptimized: true
  },
  typedRoutes: true
};

export default nextConfig;
