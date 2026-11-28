/**
 * Route page. Scan a machine's QR label (or type its fleet number) to open it.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { ScanScreen } from "@/components/scan-screen";

export const metadata: Metadata = { title: "Scan a machine" };

export default function ScanPage() {
  return <ScanScreen />;
}
