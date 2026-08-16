import type { MetadataRoute } from "next";

/**
 * Web App Manifest — makes Basecamp installable to the home screen on
 * iOS and Android, and lets Chrome/Edge treat it as an app when
 * launched standalone.
 *
 * Icons are generated dynamically from src/app/icon.tsx and
 * src/app/apple-icon.tsx via Next.js ImageResponse — no static PNGs
 * to maintain.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Basecamp — trail readiness",
    short_name: "Basecamp",
    description:
      "Personalized trail readiness for any hike you're planning.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0b0d",
    theme_color: "#0a0b0d",
    categories: ["fitness", "health", "sports", "utilities"],
    icons: [
      {
        // File-based route from src/app/icon.tsx — 512x512 PNG.
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Today's quest",
        short_name: "Today",
        url: "/",
      },
      {
        name: "Browse trails",
        short_name: "Trails",
        url: "/trails",
      },
      {
        name: "Your progress",
        short_name: "Progress",
        url: "/progress",
      },
    ],
  };
}
