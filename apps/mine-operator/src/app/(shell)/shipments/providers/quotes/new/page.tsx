/**
 * Route page. Renders the new quote request form.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { NewQuoteRequestScreen } from "@/components/transport-screens";

export default function Page() {
  return <NewQuoteRequestScreen />;
}
