import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eleventory",
    short_name: "Eleventory",
    description: "Open an online store, keep stock right and get paid. Made for sellers in Bangladesh.",
    start_url: "/",
    display: "standalone",
    background_color: "#F1F4F3",
    theme_color: "#0A2E2C",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
