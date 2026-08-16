import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

/**
 * iOS home-screen icon. Same design as the main icon but at Apple's
 * expected 180x180 resolution. iOS auto-composites this behind a
 * squircle mask, so no explicit rounded corners needed.
 */
export default function AppleIcon() {
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
          <rect width="512" height="512" fill="#0a0b0d" />
          <path
            d="M-20 380 L120 180 L200 260 L280 200 L400 340 L532 220 L532 512 L-20 512 Z"
            fill="#1e3a8a"
          />
          <path
            d="M-20 440 L160 240 L240 320 L320 220 L448 380 L532 300 L532 512 L-20 512 Z"
            fill="#3b82f6"
          />
          <path
            d="M160 240 L200 300 L260 240"
            fill="none"
            stroke="#93c5fd"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M160 240 L200 296 L240 246"
            fill="#e0f2fe"
          />
          <circle cx="320" cy="220" r="6" fill="#7dd3fc" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
