import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Use webpack for build (required for next-pwa)
  turbopack: {},
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${process.env.TEAM_SERVER_URL || "http://localhost:3030"}/api/:path*`,
      },
      {
        source: "/ws",
        destination: `${process.env.TEAM_SERVER_URL || "http://localhost:3030"}/ws`,
      },
    ];
  },
};

export default withPWA(nextConfig);
