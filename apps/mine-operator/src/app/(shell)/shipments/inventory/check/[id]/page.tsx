/**
 * Route page. Renders Check production: confirm a reported amount into inventory.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { CheckProductionScreen } from "@/components/production-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckProductionScreen id={id} />;
}
