/**
 * The web app manifest for VESPER Mobile, served at /manifest.webmanifest. It is what makes a phone offer "Add to Home Screen"
 * (or "Install app"); the installed app opens on My Shift in its own window, without the browser's address bar.
 * There is deliberately no second service worker: the mock service worker already owns this site's scope.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VESPER Mobile",
    short_name: "VESPER",
    description: "VESPER for field teams: your shift, your work, and reporting issues from where you are.",
    start_url: "/my-shift",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7f5",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
