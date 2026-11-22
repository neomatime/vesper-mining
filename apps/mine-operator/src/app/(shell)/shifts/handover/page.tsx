/**
 * Route page. Opens the handover of the current shift. Needs shift_handover.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@/components/entitlement-gate";
import { HandoverTabScreen } from "@/components/shift-control-screens";

export default function Page() {
  return <FeatureGate feature="shift_handover"><HandoverTabScreen /></FeatureGate>;
}
