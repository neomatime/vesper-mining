import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Administration" };
export default function AdminPage() { return <WorkspaceScreen workspace="admin" />; }
