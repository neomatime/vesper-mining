import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Shift Control" };
export default function ShiftsPage() { return <WorkspaceScreen workspace="shifts" />; }
