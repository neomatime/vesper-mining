import type { Metadata } from "next";
import { NewServiceRequestScreen } from "@/components/service-request-screens";

export const metadata: Metadata = { title: "Request service" };

export default async function NewServiceRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ planId?: string }> }) {
  const { id } = await params;
  const { planId } = await searchParams;
  return <NewServiceRequestScreen equipmentId={id} planId={planId ?? null} />;
}
