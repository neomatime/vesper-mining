/**
 * Route page. Renders one piece of equipment.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { EquipmentDetailScreen } from "@/components/equipment-detail-screen";

export default async function EquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EquipmentDetailScreen id={id} />;
}
