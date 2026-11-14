import { FeatureGate } from "@/components/entitlement-gate";
import { ShiftDetailScreen } from "@/components/shift-detail-screen";

export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeatureGate feature="shift_handover"><ShiftDetailScreen id={id} handover /></FeatureGate>;
}
