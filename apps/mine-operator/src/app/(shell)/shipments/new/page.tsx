/**
 * Route page. Renders the Create shipment task.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { CreateShipmentScreen } from "@/components/shipments-screens";

export default function Page() {
  return <CreateShipmentScreen />;
}
