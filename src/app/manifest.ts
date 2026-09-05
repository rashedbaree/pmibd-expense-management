import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PMI Bangladesh Expense Management System",
    short_name: "PMIBD Expenses",
    description:
      "Submit, approve, track, and report PMI Bangladesh Chapter expenses.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8f5f0",
    theme_color: "#4f17a8",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
