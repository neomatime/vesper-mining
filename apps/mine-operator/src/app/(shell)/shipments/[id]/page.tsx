/**
 * Route page. Renders one shipment: readiness, collection, dispatch and delivery.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ShipmentScreen } from "@/components/shipments-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShipmentScreen id={id} />;
}
