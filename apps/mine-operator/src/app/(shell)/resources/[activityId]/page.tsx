import { FeatureGate } from "@/components/entitlement-gate";
import { ReadinessDetailScreen } from "@/components/readiness-detail-screen";

export default async function ReadinessPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  return <FeatureGate feature="resource_readiness"><ReadinessDetailScreen id={activityId} /></FeatureGate>;
}
