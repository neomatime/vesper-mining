import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { DemoProviders } from "@/components/demo-providers";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./theme.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
    <html lang="en-ZA" className={inter.variable}>
      <body>
        <DemoProviders>{children}</DemoProviders>
      </body>
    </html>
  );
}
