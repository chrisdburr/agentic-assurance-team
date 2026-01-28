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
  rewrites() {
    return [
      // WebSocket proxy - doesn't need user identity injection
      {
        source: "/ws",
        destination: `${process.env.TEAM_SERVER_URL || "http://localhost:3030"}/ws`,
      },
      // Note: /backend/* is now handled by src/app/api/backend/[...path]/route.ts
      // which injects X-User-Id and X-Username headers for user identity
    ];
  },
};

export default withPWA(nextConfig);
