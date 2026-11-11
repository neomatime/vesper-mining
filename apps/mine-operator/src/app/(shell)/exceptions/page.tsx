import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Work & Exceptions" };
export default function ExceptionsPage() { return <WorkspaceScreen workspace="exceptions" />; }
