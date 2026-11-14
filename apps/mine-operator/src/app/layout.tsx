/**
 * The root layout: the HTML shell, the fonts, the style sheets in the order they must load, and the providers that start the
 * demo API. The inline theme script in the head sets light or dark before the first paint, so there is no flash.
 */
import type { Metadata, Viewport } from "next";
import { DemoProviders } from "@/components/demo-providers";
import { themeInitScript } from "@/lib/theme";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./theme.css";
import "./typography.css";
import "./chrome.css";
import "./dark.generated.css";
import "./dark.css";
import "./login.css";
import "./allocation.css";

export const metadata: Metadata = {
  title: {
    default: "VESPER",
    template: "%s · VESPER",
  },
  description: "Operational coordination for mining. Identify delays, prevent avoidable waiting, recover productive time.",
  robots: { index: false, follow: false },
};

/** On phones that support it, the page shrinks to the space above the keyboard instead of sliding under it. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/Inter-Variable-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <DemoProviders>{children}</DemoProviders>
      </body>
    </html>
  );
}
