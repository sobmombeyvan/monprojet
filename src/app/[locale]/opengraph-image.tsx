import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const runtime = "edge";
export const alt = `${site.name} - international mobility and expertise`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const subtitle = locale === "en"
    ? "International mobility, trusted information and expert guidance"
    : "Mobilite internationale, information fiable et expertise";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "#102B46",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ color: "#25AFA5", fontSize: 28, fontWeight: 700, marginBottom: 24 }}>EXPERTISE INTERNATIONALE</div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>{site.name}</div>
        <div style={{ maxWidth: 900, marginTop: 28, fontSize: 34, lineHeight: 1.35, color: "#DCE7EF" }}>{subtitle}</div>
      </div>
    ),
    size,
  );
}
