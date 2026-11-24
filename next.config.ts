import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API routes read /content/*.md at runtime with fs. This tells Vercel's
  // bundler to ship those files with the serverless functions.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/**/*"],
    "/api/fit": ["./content/**/*"],
    // Server actions on admin pages run the Fit Check, which reads /content.
    // Admin pages also render resume PDFs, which need the font files.
    "/admin/**": ["./content/**/*", "./lib/resume/fonts/**/*"],
    "/api/admin/**": ["./content/**/*", "./lib/resume/fonts/**/*"],
  },
  // The PDF renderer loads fonts and its layout engine at runtime; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Keep the admin area out of search engines.
  async headers() {
    return [{ source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
