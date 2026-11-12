import type { Metadata } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA" className={inter.variable}>
      <body>
        <DemoProviders>{children}</DemoProviders>
      </body>
    </html>
  );
}
