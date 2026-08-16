import { ImageResponse } from "next/og";

// Route segment config
export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

/**
 * App icon — mountain silhouette on the Basecamp dark background.
 * Dynamically rendered at request/build time via Next's ImageResponse,
 * so we don't ship binary PNGs in the repo.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0b0d",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          fontSize: 0,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          style={{ width: "100%", height: "100%" }}
        >
          {/* Background */}
          <rect width="512" height="512" fill="#0a0b0d" />
          {/* Back mountain (lighter) */}
          <path
            d="M-20 380 L120 180 L200 260 L280 200 L400 340 L532 220 L532 512 L-20 512 Z"
            fill="#1e3a8a"
          />
          {/* Front mountain (accent blue) */}
          <path
            d="M-20 440 L160 240 L240 320 L320 220 L448 380 L532 300 L532 512 L-20 512 Z"
            fill="#3b82f6"
          />
          {/* Peak highlight */}
          <path
            d="M160 240 L200 300 L260 240"
            fill="none"
            stroke="#93c5fd"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Snow cap on front peak */}
          <path
            d="M160 240 L200 296 L240 246"
            fill="#e0f2fe"
          />
          {/* Small star / summit marker */}
          <circle cx="320" cy="220" r="6" fill="#7dd3fc" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
