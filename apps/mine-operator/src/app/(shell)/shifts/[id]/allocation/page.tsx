/**
 * Route page. Renders the printable work allocation sheet for a shift.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ShiftAllocationScreen } from "@/components/shift-allocation-screen";

export default async function AllocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShiftAllocationScreen id={id} />;
}
