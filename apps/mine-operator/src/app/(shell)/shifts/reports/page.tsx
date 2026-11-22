/**
 * Route page. Renders the Reports tab of Shift Control: production against plan.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ShiftReportsScreen } from "@/components/shift-control-screens";

export default function Page() {
  return <ShiftReportsScreen />;
}
