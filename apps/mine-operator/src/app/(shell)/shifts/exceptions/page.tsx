/**
 * Route page. Renders the Exceptions tab of Shift Control: the issues holding up a shift.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ShiftExceptionsScreen } from "@/components/shift-control-screens";

export default function Page() {
  return <ShiftExceptionsScreen />;
}
