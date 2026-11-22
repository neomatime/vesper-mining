/**
 * Route page. Renders transport agreements.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { AgreementsScreen } from "@/components/transport-agreement-screens";

export default function Page() {
  return <AgreementsScreen />;
}
