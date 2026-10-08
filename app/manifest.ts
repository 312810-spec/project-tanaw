import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Project TANAW", short_name: "TANAW",
    description: "School SMEA preparation and review workspace",
    start_url: "/workspace", scope: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#1b3a8c",
    icons: [192, 512].map((size) => ({ src: `/api/app-icon?size=${size}`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
