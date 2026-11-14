import { FeatureGate } from "@/components/entitlement-gate";
import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace-screen";

export const metadata: Metadata = { title: "Resource Readiness" };
export default function ResourcesPage() { return <FeatureGate feature="resource_readiness"><WorkspaceScreen workspace="resources" /></FeatureGate>; }
