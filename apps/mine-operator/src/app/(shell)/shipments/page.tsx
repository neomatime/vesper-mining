/**
 * Route page. Renders the Shipments overview.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ShipmentOverviewScreen } from "@/components/shipments-screens";

export default function Page() {
  return <ShipmentOverviewScreen />;
}
