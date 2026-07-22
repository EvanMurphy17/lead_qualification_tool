import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The full dataset lives outside public/ (auth-gated) — make sure the file
  // is included when the route is traced for deployment (e.g. Vercel).
  outputFileTracingIncludes: {
    "/api/data/buildings": ["./private-data/**"],
  },
};

export default nextConfig;
