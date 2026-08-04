import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

export default {
  ...config,
  // Run the Next build directly. The package.json `build` script points at
  // `opennextjs-cloudflare build` (so Workers Builds' default command works),
  // and without this override OpenNext would re-invoke that script and recurse.
  buildCommand: "npx next build",
};
