/**
 * Route page. The pre-start check for one machine.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { PrestartCheckScreen } from "@/components/prestart-check-screen";

export default async function PrestartCheckPage({ params }: { params: Promise<{ equipmentId: string }> }) {
  const { equipmentId } = await params;
  return <PrestartCheckScreen equipmentId={equipmentId} />;
}
