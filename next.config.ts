import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Force webpack instead of Turbopack (more reliable on certain Windows paths)
  experimental: {
    // @ts-expect-error - disable turbopack explicitly
    turbo: false,
  },
};

export default nextConfig;
