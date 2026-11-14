/**
 * Route page. Renders the issues register (WorkspaceScreen). Issues are called exceptions in the address..
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Work & Exceptions" };
export default function ExceptionsPage() { return <WorkspaceScreen workspace="exceptions" />; }
