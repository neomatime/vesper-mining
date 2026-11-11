import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Resource Readiness" };
export default function ResourcesPage() { return <WorkspaceScreen workspace="resources" />; }
