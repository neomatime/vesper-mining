/**
 * The presenter launcher at /demo. Also the address the test runner waits on to know the app is up.
 */
import type { Metadata } from "next";
import { DemoLauncher } from "@/components/demo-launcher";

export const metadata: Metadata = { title: "Presenter console" };

export default function DemoPage() {
  return <DemoLauncher />;
}
