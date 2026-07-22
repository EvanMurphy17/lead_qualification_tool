import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes getCloudflareContext() (D1/R2 bindings) available during `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // The full dataset lives outside public/ (auth-gated). Locally it is read
  // from disk; on Cloudflare it comes from R2. Keep the file traced for
  // Node-based deployments too.
  outputFileTracingIncludes: {
    "/api/data/buildings": ["./private-data/**"],
  },
};

export default nextConfig;
