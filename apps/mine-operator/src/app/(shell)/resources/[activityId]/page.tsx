import { ReadinessDetailScreen } from "@/components/readiness-detail-screen";

export default async function ReadinessPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  return <ReadinessDetailScreen id={activityId} />;
}
