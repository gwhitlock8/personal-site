import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API routes read /content/*.md at runtime with fs. This tells Vercel's
  // bundler to ship those files with the serverless functions.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/**/*"],
    "/api/fit": ["./content/**/*"],
  },
};

export default nextConfig;
