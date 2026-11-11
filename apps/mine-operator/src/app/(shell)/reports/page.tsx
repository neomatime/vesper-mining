import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Reports" };
export default function ReportsPage() { return <WorkspaceScreen workspace="reports" />; }
