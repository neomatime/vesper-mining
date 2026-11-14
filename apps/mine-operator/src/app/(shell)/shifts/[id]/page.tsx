/**
 * Route page. Renders one shift.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ShiftDetailScreen } from "@/components/shift-detail-screen";

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShiftDetailScreen id={id} />;
}
