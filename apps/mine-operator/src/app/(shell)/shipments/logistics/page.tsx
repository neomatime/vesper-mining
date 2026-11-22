/**
 * Route page. Renders Logistics: collection requests and approved providers.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { LogisticsScreen } from "@/components/shipments-screens";

export default function Page() {
  return <LogisticsScreen />;
}
