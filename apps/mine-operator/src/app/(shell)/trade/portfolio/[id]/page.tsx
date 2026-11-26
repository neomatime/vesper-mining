/**
 * Route page. Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ClientScreen } from "@/components/trade/trade-portfolio";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientScreen id={id} />;
}
