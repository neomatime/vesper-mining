/**
 * Route page. Renders the new service request form. Needs equipment_maintenance.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@core/components/entitlement-gate";
import type { Metadata } from "next";
import { NewServiceRequestScreen } from "@/components/service-request-screens";

export const metadata: Metadata = { title: "Request service" };

export default async function NewServiceRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ planId?: string }> }) {
  const { id } = await params;
  const { planId } = await searchParams;
  return <FeatureGate feature="equipment_maintenance"><NewServiceRequestScreen equipmentId={id} planId={planId ?? null} /></FeatureGate>;
}
