import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default config: no incremental cache (all app pages are dynamic or
// build-time static; nothing uses ISR).
export default defineCloudflareConfig({});
