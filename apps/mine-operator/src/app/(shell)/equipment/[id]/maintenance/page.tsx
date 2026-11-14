import { FeatureGate } from "@/components/entitlement-gate";
import { EquipmentDetailScreen } from "@/components/equipment-detail-screen";

export default async function EquipmentMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeatureGate feature="equipment_maintenance"><EquipmentDetailScreen id={id} maintenance /></FeatureGate>;
}
