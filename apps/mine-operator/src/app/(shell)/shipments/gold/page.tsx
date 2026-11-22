/**
 * Route page. Renders the Gold demonstration delivery: the original commitment, the current forecast and what links them.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { GoldShipmentScreen } from "@/components/impact-panels";

export default function Page() {
  return <GoldShipmentScreen />;
}
