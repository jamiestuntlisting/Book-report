// Access to Cloudflare bindings (D1, R2, Browser Rendering) from Next.js code.
// In production these come from the Worker environment; during `next dev`,
// initOpenNextCloudflareForDev() in next.config.ts wires up local emulations.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket, Fetcher } from "@cloudflare/workers-types";

export interface AppBindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  BROWSER?: Fetcher;
}

export function getBindings(): AppBindings {
  const { env } = getCloudflareContext();
  return env as unknown as AppBindings;
}
