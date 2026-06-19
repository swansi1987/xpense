import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Help with workspace root detection on unusual paths (e.g. Google Drive on Windows)
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
