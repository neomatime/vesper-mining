import type { Metadata } from "next";
import { DemoLauncher } from "@/components/demo-launcher";

export const metadata: Metadata = { title: "Demo Launch" };

export default function DemoPage() {
  return <DemoLauncher />;
}
