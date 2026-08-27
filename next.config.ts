import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allowed remote hosts for next/image. Kept to license-clean
    // sources for trail hero photos (see lib/basecamp/trail-details.ts).
    remotePatterns: [
      // Wikipedia Commons — CC-BY-SA / public-domain photos.
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
      // Unsplash — free-use license; direct-linkable via
      // images.unsplash.com.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // NPS.gov photos — public domain (federal works).
      { protocol: "https", hostname: "www.nps.gov", pathname: "/**" },
    ],
  },
};

export default nextConfig;
