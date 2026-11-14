/**
 * Route page. Renders Resource Readiness. Needs resource_readiness.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@/components/entitlement-gate";
import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Resource Readiness" };
export default function ResourcesPage() { return <FeatureGate feature="resource_readiness"><WorkspaceScreen workspace="resources" /></FeatureGate>; }
