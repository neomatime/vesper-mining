/**
 * Route page. Renders the form to record or edit an agreement.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { AgreementFormScreen } from "@/components/transport-agreement-screens";

export default function Page() {
  return <AgreementFormScreen />;
}
