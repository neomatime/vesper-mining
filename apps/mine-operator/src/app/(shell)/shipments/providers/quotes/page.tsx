/**
 * Route page. Renders transport quotes.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { QuotesScreen } from "@/components/transport-screens";

export default function Page() {
  return <QuotesScreen />;
}
