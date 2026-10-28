import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Content hash of the injected runtime. Its URL carries it, so a new runtime
// reaches every page at once instead of waiting out browser and CDN caches.
const runtimeVersion = createHash("sha256")
  .update(readFileSync("public/claude-runtime.js"))
  .digest("hex")
  .slice(0, 12);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { RUNTIME_VERSION: runtimeVersion },
  serverExternalPackages: ["postgres"],
  experimental: {
    // Assets and HTML publishes can be tens of MB.
    serverActions: { bodySizeLimit: "32mb" },
  },
  async rewrites() {
    // App Router treats `_`-prefixed folders as private, so the public
    // `/_blob/<id>` and `/_files/<artifact>/<path>` URLs the runtime contract
    // promises are rewritten onto ordinary route folders.
    return [
      { source: "/_blob/:id", destination: "/blob/:id" },
      { source: "/_files/:artifactId/:path*", destination: "/files/:artifactId/:path*" },
    ];
  },
  async headers() {
    return [
      {
        // Versioned URLs are immutable; a bare URL must always revalidate.
        source: "/claude-runtime.js",
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/claude-runtime.js",
        missing: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
