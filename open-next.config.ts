import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // No incremental cache / queue overrides for the demo deploy.
  // Add an R2/KV incremental cache here if ISR/revalidation is needed later.
});
