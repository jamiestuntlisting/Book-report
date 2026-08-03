import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default config: no incremental cache backend needed — every page in the app
// is dynamic (force-dynamic or per-request auth).
export default defineCloudflareConfig();
