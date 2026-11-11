import type { Metadata } from "next";
import { DemoProviders } from "@/components/demo-providers";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VESPER · Simulated Operations",
    template: "%s · VESPER",
  },
  description: "Interactive VESPER UI/UX prototype using fictional simulated operational data.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body>
        <DemoProviders>{children}</DemoProviders>
      </body>
    </html>
  );
}
