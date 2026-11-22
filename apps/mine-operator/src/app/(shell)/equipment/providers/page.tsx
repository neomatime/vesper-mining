/**
 * Route page. Renders Manage Service Providers: the directory of repair and maintenance providers.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ProviderDirectoryScreen } from "@/components/provider-directory-screens";

export default function Page() {
  return <ProviderDirectoryScreen />;
}
