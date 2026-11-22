/**
 * Route page. Renders the Production tab of Shift Control.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ProductionListScreen } from "@/components/production-screens";

export default function Page() {
  return <ProductionListScreen />;
}
