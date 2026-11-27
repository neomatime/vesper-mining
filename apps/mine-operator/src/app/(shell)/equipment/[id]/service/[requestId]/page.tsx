/**
 * Route page. Renders one service request with its quotes. Needs equipment_maintenance.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@core/components/entitlement-gate";
import type { Metadata } from "next";
import { ServiceRequestScreen } from "@/components/service-request-screens";

export const metadata: Metadata = { title: "Service request" };

export default async function ServiceRequestPage({ params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { id, requestId } = await params;
  return <FeatureGate feature="equipment_maintenance"><ServiceRequestScreen equipmentId={id} requestId={requestId} /></FeatureGate>;
}
