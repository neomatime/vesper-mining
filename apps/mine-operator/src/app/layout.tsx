/**
 * The root layout: the HTML shell, the fonts, the style sheets in the order they must load, and the providers that start the
 * demo API. The inline theme script in the head sets light or dark before the first paint, so there is no flash.
 */
import type { Metadata, Viewport } from "next";
import { AppProvider } from "@core/components/app-context";
import { DemoProviders } from "@core/components/demo-providers";
import { themeInitScript } from "@core/lib/theme";
import "leaflet/dist/leaflet.css";
import "@core/styles/globals.css";
import "@core/styles/theme.css";
import "@core/styles/typography.css";
import "@core/styles/chrome.css";
import "@core/styles/dark.generated.css";
import "@core/styles/dark.css";
import "@core/styles/login.css";
import "./allocation.css";
import "@core/styles/modules.css";
import "./trade.css";
import "./delivery-map.css";
import "./delivery-plan.css";
import "@core/styles/motion.css";
import "@core/styles/refinements.css";

export const metadata: Metadata = {
  title: {
    default: "VESPER",
    template: "%s · VESPER",
  },
  description: "Operational coordination for mining. Identify delays, prevent avoidable waiting, recover productive time.",
  robots: { index: false, follow: false },
  // Lets an installed copy on iPhone open full screen with the right name (the manifest covers Chrome, Edge and Android).
  appleWebApp: { capable: true, title: "VESPER", statusBarStyle: "default" },
};

/** On phones that support it, the page shrinks to the space above the keyboard instead of sliding under it. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content", themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/Inter-Variable-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppProvider app="operations">
          <DemoProviders>{children}</DemoProviders>
        </AppProvider>
      </body>
    </html>
  );
}
