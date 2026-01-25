import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Team Chat",
    short_name: "TeamChat",
    description: "AI Team Communication Dashboard",
    start_url: "/team",
    display: "standalone",
    background_color: "#1f2937",
    theme_color: "#1f2937",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
