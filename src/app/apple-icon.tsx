import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102b46", borderRadius: 38 }}>
        <svg width="126" height="126" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14.5" stroke="white" strokeWidth="1.4" />
          <path d="M1.5 16h29M16 1.5c4 4 6 9 6 14.5s-2 10.5-6 14.5c-4-4-6-9-6-14.5s2-10.5 6-14.5Z" stroke="white" strokeWidth="1" opacity=".65" />
          <circle cx="22" cy="9.5" r="2.2" fill="#25AFA5" />
        </svg>
      </div>
    ),
    size,
  );
}
