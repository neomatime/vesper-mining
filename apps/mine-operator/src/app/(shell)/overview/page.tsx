import type { Metadata } from "next";
import { OverviewScreen } from "@/components/overview-screen";

export const metadata: Metadata = { title: "Command Centre" };
export default function OverviewPage() { return <OverviewScreen />; }
