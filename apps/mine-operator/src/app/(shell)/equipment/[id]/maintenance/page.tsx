/**
 * Route page. Renders the equipment page opened on maintenance. Needs the equipment_maintenance feature, so it is wrapped in FeatureGate.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@core/components/entitlement-gate";
import { EquipmentDetailScreen } from "@/components/equipment-detail-screen";

export default async function EquipmentMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeatureGate feature="equipment_maintenance"><EquipmentDetailScreen id={id} maintenance /></FeatureGate>;
}
