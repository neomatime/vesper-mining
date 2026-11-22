/**
 * Route page. Renders one service provider: details, linked repair requests, history and audit trail.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ProviderDetailScreen } from "@/components/provider-directory-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderDetailScreen id={id} />;
}
