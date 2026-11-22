/**
 * Route page. Renders Shipment history: delivered and cancelled shipments.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { HistoryScreen } from "@/components/shipments-screens";

export default function Page() {
  return <HistoryScreen />;
}
