/**
 * Route page. Renders one agreement, its allowance and fees.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { AgreementScreen } from "@/components/transport-agreement-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgreementScreen id={id} />;
}
