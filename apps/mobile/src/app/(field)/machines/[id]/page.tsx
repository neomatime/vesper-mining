/**
 * Route page. A machine, as opened from its QR label: status, pre-start check, open issues and what to do.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { MachineScreen } from "@/components/machine-screen";

export default async function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MachineScreen id={id} />;
}
