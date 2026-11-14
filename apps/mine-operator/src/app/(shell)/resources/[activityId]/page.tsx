/**
 * Route page. Renders one readiness activity. Needs resource_readiness.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@/components/entitlement-gate";
import { ReadinessDetailScreen } from "@/components/readiness-detail-screen";

export default async function ReadinessPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  return <FeatureGate feature="resource_readiness"><ReadinessDetailScreen id={activityId} /></FeatureGate>;
}
