/**
 * Route page. Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { DeliveryScreen } from "@/components/trade/trade-deliveries";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryScreen id={id} />;
}
