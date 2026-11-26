/**
 * Route page. Renders Repair Requests: every repair and service request with an external provider.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { RepairRequestsScreen } from "@/components/repair-requests-screen";

export default function Page() {
  return <RepairRequestsScreen />;
}
