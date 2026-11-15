/**
 * The web app manifest, served at /manifest.webmanifest and linked from every page by Next.js.
 * It is what makes browsers offer "Install VESPER" (the install icon in Chrome and Edge's address bar, "Add to Home Screen" on
 * phones). An installed VESPER opens in its own window, without the browser's tabs and address bar.
 *
 * Installability needs: a name, a start address, standalone display, and 192 and 512 pixel icons, over HTTPS. There is
 * deliberately no second service worker: the mock service worker already owns this site's scope, and installing does not need
 * one. It follows that the installed app is not available offline.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VESPER – The Mining Operating System",
    short_name: "VESPER",
    description: "Operational coordination for mining. Identify delays, prevent avoidable waiting, recover productive time.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7f5",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // A full-bleed version with the mark inside the safe zone, for phones that crop icons to a circle or squircle.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
