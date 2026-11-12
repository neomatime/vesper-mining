import type { Metadata } from "next";
import { ServiceRequestScreen } from "@/components/service-request-screens";

export const metadata: Metadata = { title: "Service request" };

export default async function ServiceRequestPage({ params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { id, requestId } = await params;
  return <ServiceRequestScreen equipmentId={id} requestId={requestId} />;
}
