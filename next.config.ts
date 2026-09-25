import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate build directory lets a temporary local test run without
  // interrupting another Next development server using the default `.next`.
  distDir: process.env.CTRUGBY_NEXT_DIST_DIR || ".next",
};

export default nextConfig;
