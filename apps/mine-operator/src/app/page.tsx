import type { Metadata } from "next";
import { EnvironmentSelectScreen } from "@/components/environment-select-screen";

export const metadata: Metadata = { title: "Select an environment" };

export default function Home() {
  return <EnvironmentSelectScreen />;
}
