/**
 * Route page. Renders the Handover tab of Shift Control for the current shift. Needs shift_handover.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@core/components/entitlement-gate";
import { HandoverTabScreen } from "@/components/shift-control-screens";

export default function Page() {
  return <FeatureGate feature="shift_handover"><HandoverTabScreen /></FeatureGate>;
}
