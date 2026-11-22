/**
 * Route page. Renders the Shipments tab: active shipments.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ShipmentListScreen } from "@/components/shipments-screens";

export default function Page() {
  return <ShipmentListScreen />;
}
