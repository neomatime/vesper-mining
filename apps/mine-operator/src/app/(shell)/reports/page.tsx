import type { Metadata } from "next";
import { ReportsIndexScreen } from "@/components/reports-index-screen";

export const metadata: Metadata = { title: "Reports" };
export default function ReportsPage() { return <ReportsIndexScreen />; }
