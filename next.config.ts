import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile exists in a parent directory).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

// Makes getCloudflareContext() usable during `next dev` (bindings via miniflare).
initOpenNextCloudflareForDev();
