import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Equipment & Maintenance" };
export default function EquipmentPage() { return <WorkspaceScreen workspace="equipment" />; }
