import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
