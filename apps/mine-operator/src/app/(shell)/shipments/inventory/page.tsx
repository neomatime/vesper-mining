/**
 * Route page. Renders Mineral Inventory: stock by location and recent movement.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { InventoryScreen } from "@/components/shipments-screens";

export default function Page() {
  return <InventoryScreen />;
}
