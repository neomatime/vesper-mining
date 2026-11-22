/**
 * Route page. Renders one quote request and its quotes.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { QuoteRequestScreen } from "@/components/transport-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuoteRequestScreen id={id} />;
}
