import { ImageResponse } from "next/og";

export function GET(request: Request) {
  const size = new URL(request.url).searchParams.get("size") === "192" ? 192 : 512;
  return new ImageResponse(
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#1b3a8c", color: "white", width: "100%", height: "100%", fontSize: size * 0.6, fontWeight: 700 }}>T</div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
