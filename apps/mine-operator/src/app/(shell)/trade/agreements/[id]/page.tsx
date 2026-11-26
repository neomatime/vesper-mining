/**
 * Route page. Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { AgreementScreen } from "@/components/trade/trade-commercial";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgreementScreen id={id} />;
}
