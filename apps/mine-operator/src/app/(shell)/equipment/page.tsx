/**
 * Route page. Renders the equipment register (WorkspaceScreen).
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Equipment & Maintenance" };
export default function EquipmentPage() { return <WorkspaceScreen workspace="equipment" />; }
