import { EquipmentDetailScreen } from "@/components/equipment-detail-screen";

export default async function EquipmentMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EquipmentDetailScreen id={id} maintenance />;
}
