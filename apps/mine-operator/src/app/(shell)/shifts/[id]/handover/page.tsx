/**
 * Route page. Renders the Handover tab for one shift. Needs shift_handover.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { FeatureGate } from "@/components/entitlement-gate";
import { HandoverTabScreen } from "@/components/shift-control-screens";

export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeatureGate feature="shift_handover"><HandoverTabScreen id={id} /></FeatureGate>;
}
